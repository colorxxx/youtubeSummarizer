import { useCallback, useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { AIChatBox, type Message } from "@/components/AIChatBox";
import { RotateCcw, AlertCircle, RefreshCw } from "lucide-react";

type VideoChatSheetProps = {
  videoId: string;
  videoTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const SUGGESTED_PROMPTS = [
  "이 영상의 핵심 내용은?",
  "더 자세히 설명해줘",
  "관련 주제 추천해줘",
];

export function VideoChatSheet({ videoId, videoTitle, open, onOpenChange }: VideoChatSheetProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<{ message: string; failedContent: string } | null>(null);
  const loadedVideoRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const historyQuery = trpc.chat.history.useQuery(
    { videoId },
    { enabled: open && loadedVideoRef.current !== videoId },
  );

  // Sync history data into messages state
  useEffect(() => {
    if (historyQuery.data && loadedVideoRef.current !== videoId) {
      setMessages(historyQuery.data.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })));
      loadedVideoRef.current = videoId;
      setError(null);
    }
  }, [historyQuery.data, videoId]);

  const utils = trpc.useUtils();

  const clearMutation = trpc.chat.clear.useMutation({
    onSuccess: () => {
      setMessages([]);
      setError(null);
      loadedVideoRef.current = videoId;
      utils.chat.history.invalidate({ videoId });
    },
  });

  const handleClearChat = () => {
    if (!confirm("대화 기록을 모두 삭제하시겠습니까?")) return;
    clearMutation.mutate({ videoId });
  };

  const sendStreamMessage = useCallback(async (content: string) => {
    setError(null);
    setIsStreaming(true);

    // Add assistant placeholder for streaming
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId, message: content }),
        credentials: "include",
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || `HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

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
            if (parsed.error) {
              throw new Error(parsed.error);
            }
            if (parsed.content) {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last && last.role === "assistant") {
                  updated[updated.length - 1] = { ...last, content: last.content + parsed.content };
                }
                return updated;
              });
            }
          } catch (e) {
            if (e instanceof Error && e.message !== "Unexpected end of JSON input") {
              throw e;
            }
          }
        }
      }
    } catch (err) {
      if (controller.signal.aborted) return;

      const errorMessage = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다";
      setError({ message: errorMessage, failedContent: content });

      // Remove the empty assistant placeholder on error
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.role === "assistant" && !last.content) {
          return prev.slice(0, -1);
        }
        return prev;
      });
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [videoId]);

  const handleSendMessage = (content: string) => {
    setMessages((prev) => [...prev, { role: "user", content }]);
    sendStreamMessage(content);
  };

  const handleRetry = () => {
    if (!error) return;
    const failedContent = error.failedContent;
    setError(null);
    sendStreamMessage(failedContent);
  };

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col">
        <SheetHeader className="p-4 pb-0">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-base pr-6 line-clamp-1">AI 채팅</SheetTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={handleClearChat}
              disabled={clearMutation.isPending || messages.length === 0}
              title="대화 초기화"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
          <SheetDescription className="line-clamp-1">{videoTitle}</SheetDescription>
        </SheetHeader>
        <div className="flex-1 min-h-0 p-4 pt-2 flex flex-col">
          <AIChatBox
            messages={messages}
            onSendMessage={handleSendMessage}
            isLoading={isStreaming}
            placeholder="영상에 대해 질문하세요..."
            height="100%"
            emptyStateMessage="이 영상에 대해 궁금한 점을 물어보세요"
            suggestedPrompts={SUGGESTED_PROMPTS}
            className="border-0 shadow-none h-full"
          />
          {error && (
            <div className="flex items-center gap-2 px-2 py-2 text-sm text-destructive bg-destructive/10 rounded-md mt-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span className="flex-1 line-clamp-1">{error.message}</span>
              <Button variant="ghost" size="sm" className="h-7 px-2 shrink-0" onClick={handleRetry}>
                <RefreshCw className="h-3 w-3 mr-1" />
                재시도
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
