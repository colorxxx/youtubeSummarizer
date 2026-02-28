import type { Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { getChatHistory, saveChatMessage, getUserSummaryForVideo, getVideoByVideoId } from "./db";
import { invokeLLMStream, selectProviderForUser } from "./_core/llm";
import type { Message, ToolCall } from "./_core/llm";
import { buildChatMessages, buildSystemPrompt } from "./chatContext";
import { CHAT_TOOLS, executeToolCall } from "./webSearch";

const MAX_TOOL_ROUNDS = 3;

type PartialToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

function assembleToolCalls(
  accumulated: Map<number, PartialToolCall>,
  deltaToolCalls: Array<{ index: number; id?: string; type?: string; function?: { name?: string; arguments?: string } }>,
): void {
  for (const delta of deltaToolCalls) {
    const idx = delta.index;
    if (!accumulated.has(idx)) {
      accumulated.set(idx, {
        id: delta.id || "",
        type: "function",
        function: { name: "", arguments: "" },
      });
    }
    const tc = accumulated.get(idx)!;
    if (delta.id) tc.id = delta.id;
    if (delta.function?.name) tc.function.name += delta.function.name;
    if (delta.function?.arguments) tc.function.arguments += delta.function.arguments;
  }
}

async function readStreamFull(
  llmResponse: globalThis.Response,
  res: Response,
  shouldStreamContent: boolean,
): Promise<{ content: string; toolCalls: ToolCall[]; finishReason: string }> {
  let fullContent = "";
  let finishReason = "";
  const toolCallMap = new Map<number, PartialToolCall>();

  const reader = llmResponse.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;

        const data = trimmed.slice(6);
        if (data === "[DONE]") continue;

        try {
          const parsed = JSON.parse(data);
          const choice = parsed.choices?.[0];
          if (!choice) continue;

          if (choice.finish_reason) {
            finishReason = choice.finish_reason;
          }

          const delta = choice.delta;
          if (!delta) continue;

          // Accumulate text content
          if (delta.content) {
            fullContent += delta.content;
            if (shouldStreamContent) {
              res.write(`data: ${JSON.stringify({ content: delta.content })}\n\n`);
            }
          }

          // Accumulate tool_calls deltas
          if (delta.tool_calls) {
            assembleToolCalls(toolCallMap, delta.tool_calls);
          }
        } catch {
          // Skip malformed JSON chunks
        }
      }
    }
  } catch (streamError) {
    console.error("[ChatStream] Stream reading error:", streamError);
  }

  const toolCalls: ToolCall[] = Array.from(toolCallMap.values());
  return { content: fullContent, toolCalls, finishReason };
}

export async function handleChatStream(req: Request, res: Response) {
  try {
    // Authenticate
    const user = await sdk.authenticateRequest(req);

    const { videoId, message } = req.body as { videoId?: string; message?: string };
    if (!videoId || !message) {
      res.status(400).json({ error: "videoId and message are required" });
      return;
    }

    // Get video info and summary for context
    const [video, summary, history] = await Promise.all([
      getVideoByVideoId(videoId),
      getUserSummaryForVideo(user.id, videoId),
      getChatHistory(user.id, videoId),
    ]);

    if (!video) {
      res.status(404).json({ error: "영상 정보를 찾을 수 없습니다" });
      return;
    }

    // Determine provider for this user
    const provider = await selectProviderForUser(user.id, user.email ?? null);

    // Build system prompt with transcript
    const systemContent = await buildSystemPrompt(video, summary, videoId, provider);

    // Build messages with token budget management
    const llmMessages: Message[] = await buildChatMessages(systemContent, history, message, provider);

    // Save user message to DB
    await saveChatMessage(user.id, videoId, "user", message);

    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    let fullContent = "";

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const isLastRound = round === MAX_TOOL_ROUNDS - 1;

      const llmResponse = await invokeLLMStream({
        messages: llmMessages,
        tools: isLastRound ? undefined : CHAT_TOOLS,
        toolChoice: isLastRound ? undefined : "auto",
        provider,
      });

      if (!llmResponse.body) {
        res.write(`data: ${JSON.stringify({ error: "No response body" })}\n\n`);
        break;
      }

      // On the first round (or final answer round), stream content to client
      // On tool call rounds, don't stream intermediate content
      const isStreamingRound = round === 0 || isLastRound;

      const result = await readStreamFull(llmResponse, res, round > 0 || isStreamingRound);

      if (result.finishReason === "tool_calls" && result.toolCalls.length > 0 && !isLastRound) {
        // Notify client that we're searching
        res.write(`data: ${JSON.stringify({ searching: true })}\n\n`);

        // Add assistant message with tool_calls to conversation
        llmMessages.push({
          role: "assistant",
          content: result.content || "",
          tool_calls: result.toolCalls,
        });

        // Execute each tool call
        for (const tc of result.toolCalls) {
          const toolResult = await executeToolCall(tc);
          llmMessages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: toolResult,
          });
        }

        // Continue loop to call LLM again with tool results
        continue;
      }

      // Normal text response — content was already streamed
      fullContent = result.content;
      break;
    }

    // Save full assistant message to DB
    if (fullContent) {
      await saveChatMessage(user.id, videoId, "assistant", fullContent);
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error) {
    console.error("[ChatStream] Error:", error);
    // If headers already sent, send error as SSE
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: "스트리밍 중 오류가 발생했습니다" })}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
    } else {
      res.status(500).json({ error: "채팅 처리 중 오류가 발생했습니다" });
    }
  }
}
