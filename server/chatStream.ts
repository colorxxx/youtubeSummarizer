import type { Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { getChatHistory, saveChatMessage, getUserSummaryForVideo, getVideoByVideoId } from "./db";
import { invokeLLMStream } from "./_core/llm";
import { buildChatMessages, buildSystemPrompt } from "./chatContext";

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

    // Build system prompt with transcript
    const systemContent = await buildSystemPrompt(video, summary, videoId);

    // Build messages with token budget management
    const messages = await buildChatMessages(systemContent, history, message);

    // Save user message to DB
    await saveChatMessage(user.id, videoId, "user", message);

    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    // Call LLM with streaming
    const llmResponse = await invokeLLMStream({ messages });

    if (!llmResponse.body) {
      res.write(`data: ${JSON.stringify({ error: "No response body" })}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }

    let fullContent = "";
    const reader = llmResponse.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process SSE lines from DeepSeek
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;

          const data = trimmed.slice(6);
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              fullContent += delta;
              res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
            }
          } catch {
            // Skip malformed JSON chunks
          }
        }
      }
    } catch (streamError) {
      console.error("[ChatStream] Stream reading error:", streamError);
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
