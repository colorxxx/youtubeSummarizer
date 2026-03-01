import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bookmark, Clock, ListPlus, MessageCircle, Trash2, Youtube } from "lucide-react";
import { formatDuration } from "@/lib/utils";
import { SummaryTabs } from "./SummaryTabs";
import type { ReactNode } from "react";

export interface VideoSummaryData {
  id: number;
  videoId: string;
  summary: string;
  detailedSummary: string | null;
  createdAt: Date | string;
  videoTitle: string | null;
  videoThumbnailUrl: string | null;
  videoPublishedAt: Date | string | null;
  videoDuration: string | null;
  videoChannelId: string | null;
}

interface VideoSummaryCardProps {
  data: VideoSummaryData;
  bookmarked?: boolean;
  onChat?: () => void;
  onBookmark?: () => void;
  onPlaylistAdd?: () => void;
  onDelete?: () => void;
  isBookmarkPending?: boolean;
  isDeletePending?: boolean;
  extraActions?: ReactNode;
  showSummarizedDate?: boolean;
  cardClassName?: string;
}

export function VideoSummaryCard({
  data,
  bookmarked = false,
  onChat,
  onBookmark,
  onPlaylistAdd,
  onDelete,
  isBookmarkPending,
  isDeletePending,
  extraActions,
  showSummarizedDate = true,
  cardClassName,
}: VideoSummaryCardProps) {
  return (
    <Card className={cardClassName ?? "overflow-hidden hover:shadow-lg transition-shadow"}>
      <CardHeader className="pb-4">
        <div className="flex flex-col md:flex-row gap-3 md:gap-4">
          <a
            href={`https://youtube.com/watch?v=${data.videoId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0"
          >
            {data.videoThumbnailUrl ? (
              <img
                src={data.videoThumbnailUrl}
                alt={data.videoTitle || ""}
                className="w-full md:w-48 h-auto md:h-27 object-cover rounded-lg"
              />
            ) : (
              <div className="w-full md:w-48 h-27 bg-primary/10 rounded-lg flex items-center justify-center">
                <Youtube className="h-12 w-12 text-primary" />
              </div>
            )}
          </a>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="text-base md:text-xl mb-2">
                {data.videoTitle ? (
                  <a
                    href={`https://youtube.com/watch?v=${data.videoId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-primary transition-colors break-words"
                  >
                    {data.videoTitle}
                  </a>
                ) : (
                  data.videoId
                )}
              </CardTitle>
              <div className="flex items-center gap-1 flex-shrink-0">
                {onChat && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-primary"
                    onClick={onChat}
                    title="AI 채팅"
                  >
                    <MessageCircle className="h-4 w-4" />
                  </Button>
                )}
                {onBookmark && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`h-8 w-8 ${bookmarked ? "text-yellow-500 hover:text-yellow-600" : "text-muted-foreground hover:text-yellow-500"}`}
                    onClick={onBookmark}
                    disabled={isBookmarkPending}
                    title="북마크"
                  >
                    <Bookmark className={`h-4 w-4 ${bookmarked ? "fill-current" : ""}`} />
                  </Button>
                )}
                {onPlaylistAdd && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-primary"
                    onClick={onPlaylistAdd}
                    title="재생목록에 추가"
                  >
                    <ListPlus className="h-4 w-4" />
                  </Button>
                )}
                {extraActions}
                {onDelete && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    disabled={isDeletePending}
                    onClick={() => {
                      if (confirm("이 요약을 삭제하시겠습니까?")) {
                        onDelete();
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            <CardDescription>
              {data.videoDuration && (
                <>
                  <Clock className="inline h-3.5 w-3.5 mr-1 align-text-bottom" />
                  {formatDuration(data.videoDuration)}
                  {" \u2022 "}
                </>
              )}
              {data.videoPublishedAt && (
                <>
                  {new Date(data.videoPublishedAt).toLocaleDateString("ko-KR", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                  {showSummarizedDate && " \u2022 "}
                </>
              )}
              {showSummarizedDate && (
                <>
                  {new Date(data.createdAt).toLocaleDateString("ko-KR", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}에 요약됨
                </>
              )}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <SummaryTabs summary={data.summary} detailedSummary={data.detailedSummary} />
      </CardContent>
    </Card>
  );
}
