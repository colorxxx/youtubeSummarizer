import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Link, Loader2, PlaySquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useState } from "react";
import { VideoChatSheet } from "@/components/VideoChatSheet";
import { PlaylistAddDialog } from "@/components/PlaylistAddDialog";
import { VideoSummaryCard } from "@/components/VideoSummaryCard";
import { PaginationBar } from "@/components/PaginationBar";

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
  const limit = 10;

  const { data, isLoading, refetch } = trpc.directSummary.history.useQuery({
    page,
    limit,
  });

  const summarizeMutation = trpc.directSummary.summarize.useMutation({
    onSuccess: (result) => {
      toast.success(result.message);
      setUrl("");
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

  const [chatVideo, setChatVideo] = useState<{ videoId: string; title: string } | null>(null);
  const [playlistVideo, setPlaylistVideo] = useState<{ videoId: string; title: string } | null>(null);

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
              <VideoSummaryCard
                key={summary.id}
                data={summary}
                bookmarked={bookmarkedSet.has(summary.videoId)}
                onChat={() => setChatVideo({ videoId: summary.videoId, title: summary.videoTitle || "" })}
                onBookmark={() => bookmarkMutation.mutate({ videoId: summary.videoId })}
                onPlaylistAdd={() => setPlaylistVideo({ videoId: summary.videoId, title: summary.videoTitle || "" })}
                onDelete={() => deleteMutation.mutate({ summaryId: summary.id })}
                isBookmarkPending={bookmarkMutation.isPending}
                isDeletePending={deleteMutation.isPending}
              />
            ))}
          </div>

          <PaginationBar page={page} totalPages={totalPages} onPageChange={setPage} />
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
