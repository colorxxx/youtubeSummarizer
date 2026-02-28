import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Bookmark, Clock, FileText, Loader2, MessageCircle, Search, Trash2, Youtube, ListPlus, Link, PlaySquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { formatDuration } from "@/lib/utils";
import { Streamdown } from "streamdown";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { useEffect, useRef, useState } from "react";
import { VideoChatSheet } from "@/components/VideoChatSheet";
import { PlaylistAddDialog } from "@/components/PlaylistAddDialog";

function isValidYoutubeUrl(url: string): boolean {
  const patterns = [
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=[\w-]+/,
    /(?:https?:\/\/)?youtu\.be\/[\w-]+/,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/[\w-]+/,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/[\w-]+/,
    /(?:https?:\/\/)?m\.youtube\.com\/watch\?v=[\w-]+/,
  ];
  return patterns.some((p) => p.test(url));
}

export default function DirectSummary() {
  const [url, setUrl] = useState("");
  const [page, setPage] = useState(1);
  const [chatVideo, setChatVideo] = useState<{ videoId: string; title: string } | null>(null);
  const [playlistVideo, setPlaylistVideo] = useState<{ videoId: string; title: string } | null>(null);
  const limit = 10;

  const { data, isLoading, refetch } = trpc.directSummary.history.useQuery({
    page,
    limit,
  });

  const summarizeMutation = trpc.directSummary.summarize.useMutation({
    onSuccess: (result) => {
      toast.success(result.message);
      setUrl("");
      // Refetch after a delay to allow background processing
      setTimeout(() => refetch(), 2000);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = trpc.summaries.delete.useMutation({
    onSuccess: () => {
      toast.success("요약이 삭제되었습니다");
      refetch();
    },
    onError: (error) => {
      toast.error("삭제 실패: " + error.message);
    },
  });

  const bookmarkMutation = trpc.bookmarks.toggle.useMutation({
    onSuccess: (result) => {
      toast.success(result.bookmarked ? "북마크에 추가되었습니다" : "북마크가 해제되었습니다");
      bookmarkCheckQuery.refetch();
    },
  });

  const bookmarkCheckQuery = trpc.bookmarks.check.useQuery(
    { videoIds: (data?.items ?? []).map((s) => s.videoId) },
    { enabled: (data?.items ?? []).length > 0 },
  );
  const bookmarkedSet = new Set(bookmarkCheckQuery.data?.bookmarkedIds ?? []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) {
      toast.error("YouTube URL을 입력해주세요");
      return;
    }
    if (!isValidYoutubeUrl(url.trim())) {
      toast.error("유효하지 않은 YouTube URL입니다");
      return;
    }
    summarizeMutation.mutate({ url: url.trim() });
  };

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  const getPageNumbers = () => {
    const pages: (number | "ellipsis")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push("ellipsis");
      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (page < totalPages - 2) pages.push("ellipsis");
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="container py-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">직접 요약</h1>
        <p className="text-muted-foreground">
          YouTube 영상 URL을 입력하면 AI가 자동으로 요약합니다
        </p>
      </div>

      {/* URL Input */}
      <Card className="mb-8">
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Link className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="YouTube 영상 URL을 붙여넣으세요..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="pl-10"
                disabled={summarizeMutation.isPending}
              />
            </div>
            <Button
              type="submit"
              disabled={summarizeMutation.isPending || !url.trim()}
              className="w-full sm:w-auto"
            >
              {summarizeMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  요약 중...
                </>
              ) : (
                <>
                  <PlaySquare className="mr-2 h-4 w-4" />
                  요약하기
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* History */}
      <div className="mb-6">
        <h2 className="text-2xl font-semibold mb-1">요약 히스토리</h2>
        <p className="text-sm text-muted-foreground">
          직접 요약한 영상 목록 {total > 0 && <span className="font-medium text-foreground">({total}개)</span>}
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : items.length > 0 ? (
        <>
          <div className="space-y-6">
            {items.map((summary) => (
              <Card key={summary.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                <CardHeader className="pb-4">
                  <div className="flex flex-col md:flex-row gap-3 md:gap-4">
                    {summary.videoThumbnailUrl ? (
                      <img
                        src={summary.videoThumbnailUrl}
                        alt={summary.videoTitle || ""}
                        className="w-full md:w-48 h-auto md:h-27 object-cover rounded-lg flex-shrink-0"
                      />
                    ) : (
                      <div className="w-full md:w-48 h-27 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Youtube className="h-12 w-12 text-primary" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base md:text-xl mb-2">
                          {summary.videoTitle ? (
                            <a
                              href={`https://youtube.com/watch?v=${summary.videoId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-primary transition-colors break-words"
                            >
                              {summary.videoTitle}
                            </a>
                          ) : (
                            summary.videoId
                          )}
                        </CardTitle>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                            onClick={() => setChatVideo({ videoId: summary.videoId, title: summary.videoTitle || "" })}
                            title="AI 채팅"
                          >
                            <MessageCircle className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={`h-8 w-8 ${bookmarkedSet.has(summary.videoId) ? "text-yellow-500 hover:text-yellow-600" : "text-muted-foreground hover:text-yellow-500"}`}
                            onClick={() => bookmarkMutation.mutate({ videoId: summary.videoId })}
                            disabled={bookmarkMutation.isPending}
                            title="북마크"
                          >
                            <Bookmark className={`h-4 w-4 ${bookmarkedSet.has(summary.videoId) ? "fill-current" : ""}`} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                            onClick={() => setPlaylistVideo({ videoId: summary.videoId, title: summary.videoTitle || "" })}
                            title="재생목록에 추가"
                          >
                            <ListPlus className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            disabled={deleteMutation.isPending}
                            onClick={() => {
                              if (confirm("이 요약을 삭제하시겠습니까?")) {
                                deleteMutation.mutate({ summaryId: summary.id });
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <CardDescription>
                        {summary.videoDuration && (
                          <>
                            <Clock className="inline h-3.5 w-3.5 mr-1 align-text-bottom" />
                            {formatDuration(summary.videoDuration)}
                            {" \u2022 "}
                          </>
                        )}
                        {summary.videoPublishedAt && (
                          <>
                            {new Date(summary.videoPublishedAt).toLocaleDateString("ko-KR", {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            })}
                            {" \u2022 "}
                          </>
                        )}
                        {new Date(summary.createdAt).toLocaleDateString("ko-KR", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}에 요약됨
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="brief" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="brief">간단 요약</TabsTrigger>
                      <TabsTrigger value="detailed">상세 요약</TabsTrigger>
                    </TabsList>
                    <TabsContent value="brief" className="mt-4">
                      <div className="prose prose-sm max-w-none">
                        <Streamdown>{summary.summary}</Streamdown>
                      </div>
                    </TabsContent>
                    <TabsContent value="detailed" className="mt-4">
                      <div className="prose prose-sm max-w-none">
                        <Streamdown>{summary.detailedSummary || summary.summary}</Streamdown>
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-8">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className={page <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                  {getPageNumbers().map((p, i) =>
                    p === "ellipsis" ? (
                      <PaginationItem key={`ellipsis-${i}`}>
                        <PaginationEllipsis />
                      </PaginationItem>
                    ) : (
                      <PaginationItem key={p}>
                        <PaginationLink
                          isActive={p === page}
                          onClick={() => setPage(p)}
                          className="cursor-pointer"
                        >
                          {p}
                        </PaginationLink>
                      </PaginationItem>
                    ),
                  )}
                  <PaginationItem>
                    <PaginationNext
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      className={page >= totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </>
      ) : (
        <Card className="text-center py-12">
          <CardContent className="space-y-4">
            <PlaySquare className="h-16 w-16 mx-auto text-muted-foreground" />
            <div>
              <h3 className="text-xl font-semibold mb-2">아직 직접 요약한 영상이 없습니다</h3>
              <p className="text-muted-foreground">
                위 입력란에 YouTube URL을 붙여넣어 요약을 시작하세요
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {chatVideo && (
        <VideoChatSheet
          videoId={chatVideo.videoId}
          videoTitle={chatVideo.title}
          open={!!chatVideo}
          onOpenChange={(open) => { if (!open) setChatVideo(null); }}
        />
      )}

      {playlistVideo && (
        <PlaylistAddDialog
          videoId={playlistVideo.videoId}
          videoTitle={playlistVideo.title}
          open={!!playlistVideo}
          onOpenChange={(open) => { if (!open) setPlaylistVideo(null); }}
        />
      )}
    </div>
  );
}
