import type { Message } from "../_core/llm";
import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";

export const chatRouter = router({
  history: protectedProcedure
    .input(z.object({ videoId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { getChatHistory } = await import("../db");
      return getChatHistory(ctx.user.id, input.videoId);
    }),
  send: protectedProcedure
    .input(z.object({ videoId: z.string(), message: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { getChatHistory, saveChatMessage, getUserSummaryForVideo, getVideoByVideoId } = await import("../db");
      const { invokeLLM } = await import("../_core/llm");
      const { buildChatMessages, buildSystemPrompt } = await import("../chatContext");
      const { CHAT_TOOLS, executeToolCall } = await import("../webSearch");

      const MAX_TOOL_ROUNDS = 3;

      // Get video info and summary for context
      const [video, summary, history] = await Promise.all([
        getVideoByVideoId(input.videoId),
        getUserSummaryForVideo(ctx.user.id, input.videoId),
        getChatHistory(ctx.user.id, input.videoId),
      ]);

      if (!video) throw new Error("영상 정보를 찾을 수 없습니다");

      // Build system prompt with video context and transcript
      const systemContent = await buildSystemPrompt(video, summary, input.videoId);

      // Build messages with token budget management
      const llmMessages: Message[] = await buildChatMessages(systemContent, history, input.message);

      // Save user message
      await saveChatMessage(ctx.user.id, input.videoId, "user", input.message);

      // Tool loop
      let assistantContent = "응답을 생성할 수 없습니다.";
      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const isLastRound = round === MAX_TOOL_ROUNDS - 1;
        const result = await invokeLLM({
          messages: llmMessages,
          tools: isLastRound ? undefined : CHAT_TOOLS,
          toolChoice: isLastRound ? undefined : "auto",
        });

        const choice = result.choices[0];
        if (!choice) break;

        const toolCalls = choice.message.tool_calls;
        if (toolCalls && toolCalls.length > 0 && choice.finish_reason === "tool_calls") {
          // Add assistant message with tool_calls
          llmMessages.push({
            role: "assistant",
            content: choice.message.content || "",
            tool_calls: toolCalls,
          });

          // Execute each tool call and add results
          for (const tc of toolCalls) {
            const toolResult = await executeToolCall(tc);
            llmMessages.push({
              role: "tool",
              tool_call_id: tc.id,
              content: toolResult,
            });
          }
          continue;
        }

        // Normal text response
        assistantContent =
          typeof choice.message.content === "string"
            ? choice.message.content
            : "응답을 생성할 수 없습니다.";
        break;
      }

      // Save assistant message
      await saveChatMessage(ctx.user.id, input.videoId, "assistant", assistantContent);

      return { role: "assistant" as const, content: assistantContent };
    }),
  clear: protectedProcedure
    .input(z.object({ videoId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { deleteChatHistory } = await import("../db");
      await deleteChatHistory(ctx.user.id, input.videoId);
      return { success: true };
    }),
});
