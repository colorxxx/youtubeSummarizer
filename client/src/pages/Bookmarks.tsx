import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Bookmark, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { VideoChatSheet } from "@/components/VideoChatSheet";
import { PlaylistAddDialog } from "@/components/PlaylistAddDialog";
import { VideoSummaryCard } from "@/components/VideoSummaryCard";
import { PaginationBar } from "@/components/PaginationBar";
import { SearchInput } from "@/components/SearchInput";

export default function Bookmarks() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const limit = 10;

  const { data, isLoading, refetch } = trpc.bookmarks.list.useQuery({
    page,
    limit,
    search: search || undefined,
  });

  const bookmarkMutation = trpc.bookmarks.toggle.useMutation({
    onSuccess: (result) => {
      toast.success(result.bookmarked ? "북마크에 추가되었습니다" : "북마크가 해제되었습니다");
      refetch();
    },
    onError: (error) => {
      toast.error("북마크 처리 실패: " + error.message);
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

  const [chatVideo, setChatVideo] = useState<{ videoId: string; title: string } | null>(null);
  const [playlistVideo, setPlaylistVideo] = useState<{ videoId: string; title: string } | null>(null);

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="container py-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">북마크</h1>
        <p className="text-muted-foreground">
          북마크한 영상 요약 모아보기 {total > 0 && <span className="font-medium text-foreground">({total}개)</span>}
        </p>
      </div>

      <SearchInput
        value={search}
        onChange={(v) => { setSearch(v); setPage(1); }}
      />

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
                bookmarked={true}
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
            <Bookmark className="h-16 w-16 mx-auto text-muted-foreground" />
            <div>
              <h3 className="text-xl font-semibold mb-2">
                {search ? "검색 결과가 없습니다" : "아직 북마크한 영상이 없습니다"}
              </h3>
              <p className="text-muted-foreground">
                {search
                  ? "다른 검색어를 입력해보세요"
                  : "영상 카드에서 북마크 아이콘을 클릭하여 영상을 모아보세요"}
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
