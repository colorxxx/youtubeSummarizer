import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { AIChatBox, type Message } from "@/components/AIChatBox";

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
  const loadedVideoRef = useRef<string | null>(null);

  const historyQuery = trpc.chat.history.useQuery(
    { videoId },
    { enabled: open && loadedVideoRef.current !== videoId },
  );

  // Sync history data into messages state
  useEffect(() => {
    if (historyQuery.data && loadedVideoRef.current !== videoId) {
      setMessages(historyQuery.data.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })));
      loadedVideoRef.current = videoId;
    }
  }, [historyQuery.data, videoId]);

  const sendMutation = trpc.chat.send.useMutation({
    onSuccess: (data) => {
      setMessages((prev) => [...prev, { role: data.role, content: data.content }]);
    },
  });

  const handleSendMessage = (content: string) => {
    setMessages((prev) => [...prev, { role: "user", content }]);
    sendMutation.mutate({ videoId, message: content });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col">
        <SheetHeader className="p-4 pb-0">
          <SheetTitle className="text-base pr-6 line-clamp-1">AI 채팅</SheetTitle>
          <SheetDescription className="line-clamp-1">{videoTitle}</SheetDescription>
        </SheetHeader>
        <div className="flex-1 min-h-0 p-4 pt-2">
          <AIChatBox
            messages={messages}
            onSendMessage={handleSendMessage}
            isLoading={sendMutation.isPending}
            placeholder="영상에 대해 질문하세요..."
            height="100%"
            emptyStateMessage="이 영상에 대해 궁금한 점을 물어보세요"
            suggestedPrompts={SUGGESTED_PROMPTS}
            className="border-0 shadow-none h-full"
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
