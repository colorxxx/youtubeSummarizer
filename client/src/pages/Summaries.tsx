import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { VideoChatSheet } from "@/components/VideoChatSheet";
import { PlaylistAddDialog } from "@/components/PlaylistAddDialog";
import { VideoSummaryCard } from "@/components/VideoSummaryCard";
import { PaginationBar } from "@/components/PaginationBar";
import { SearchInput } from "@/components/SearchInput";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export default function Summaries() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Array<"uncategorized" | "bookmarked" | "in_playlist">>([]);
  const limit = 10;

  const { data, isLoading, refetch } = trpc.summaries.list.useQuery({
    page,
    limit,
    search: search || undefined,
    filter: filters.length > 0 ? filters : undefined,
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

  const refreshMutation = trpc.summaries.refresh.useMutation({
    onSuccess: () => {
      toast.success("요약을 다시 생성 중입니다");
      refetch();
    },
    onError: (error) => {
      toast.error("새로고침 실패: " + error.message);
    },
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  const bookmarkCheckQuery = trpc.bookmarks.check.useQuery(
    { videoIds: items.map((s) => s.videoId) },
    { enabled: items.length > 0 },
  );
  const bookmarkedSet = new Set(bookmarkCheckQuery.data?.bookmarkedIds ?? []);

  const bookmarkMutation = trpc.bookmarks.toggle.useMutation({
    onSuccess: (result) => {
      toast.success(result.bookmarked ? "북마크에 추가되었습니다" : "북마크가 해제되었습니다");
      bookmarkCheckQuery.refetch();
      if (filters.length > 0) refetch();
    },
  });

  const [chatVideo, setChatVideo] = useState<{ videoId: string; title: string } | null>(null);
  const [playlistVideo, setPlaylistVideo] = useState<{ videoId: string; title: string } | null>(null);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>로그인 필요</CardTitle>
            <CardDescription>요약을 확인하려면 로그인해주세요</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">요약 목록</h1>
        <p className="text-muted-foreground">
          구독 채널의 AI 생성 영상 요약 {total > 0 && <span className="font-medium text-foreground">({total}개)</span>}
        </p>
      </div>

      <SearchInput
        value={search}
        onChange={(v) => { setSearch(v); setPage(1); }}
      />

      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <span className="text-sm font-medium text-muted-foreground">필터:</span>
        {([
          { value: "uncategorized", label: "미분류" },
          { value: "bookmarked", label: "북마크됨" },
          { value: "in_playlist", label: "재생목록" },
        ] as const).map(({ value, label }) => (
          <div key={value} className="flex items-center gap-1.5">
            <Checkbox
              id={`filter-${value}`}
              checked={filters.includes(value)}
              onCheckedChange={(checked) => {
                setFilters(prev =>
                  checked ? [...prev, value] : prev.filter(f => f !== value)
                );
                setPage(1);
              }}
            />
            <Label htmlFor={`filter-${value}`} className="text-sm cursor-pointer">
              {label}
            </Label>
          </div>
        ))}
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
                onRefresh={() => refreshMutation.mutate({ summaryId: summary.id })}
                onDelete={() => deleteMutation.mutate({ summaryId: summary.id })}
                isBookmarkPending={bookmarkMutation.isPending}
                isRefreshPending={refreshMutation.isPending}
                isDeletePending={deleteMutation.isPending}
              />
            ))}
          </div>

          <PaginationBar page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      ) : (
        <Card className="text-center py-12">
          <CardContent className="space-y-4">
            <FileText className="h-16 w-16 mx-auto text-muted-foreground" />
            <div>
              <h3 className="text-xl font-semibold mb-2">
                {filters.length > 0
                  ? "필터 조건에 맞는 요약이 없습니다"
                  : search
                    ? "검색 결과가 없습니다"
                    : "아직 요약이 없습니다"}
              </h3>
              <p className="text-muted-foreground">
                {filters.length > 0
                  ? "다른 필터를 선택하거나 필터를 해제해보세요"
                  : search
                    ? "다른 검색어를 입력해보세요"
                    : "채널을 구독하면 새 영상의 요약이 여기에 표시됩니다"}
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
          onPlaylistChange={() => { if (filters.length > 0) refetch(); }}
        />
      )}
    </div>
  );
}
