import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Bookmark, Clock, Edit2, ListVideo, Loader2, MessageCircle, Plus, Trash2, Youtube, ListPlus } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useState } from "react";
import { VideoChatSheet } from "@/components/VideoChatSheet";
import { PlaylistAddDialog } from "@/components/PlaylistAddDialog";

export default function Playlists() {
  const [selectedPlaylist, setSelectedPlaylist] = useState<{ id: number; name: string } | null>(null);
  const [page, setPage] = useState(1);
  const [chatVideo, setChatVideo] = useState<{ videoId: string; title: string } | null>(null);
  const [playlistDialogVideo, setPlaylistDialogVideo] = useState<{ videoId: string; title: string } | null>(null);
  const [editDialog, setEditDialog] = useState<{ id: number; name: string; description: string } | null>(null);
  const [createDialog, setCreateDialog] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const limit = 10;

  const playlistsQuery = trpc.playlists.list.useQuery();

  const playlistVideosQuery = trpc.playlists.videos.useQuery(
    { playlistId: selectedPlaylist?.id ?? 0, page, limit },
    { enabled: !!selectedPlaylist },
  );

  const bookmarkMutation = trpc.bookmarks.toggle.useMutation({
    onSuccess: (result) => {
      toast.success(result.bookmarked ? "북마크에 추가되었습니다" : "북마크가 해제되었습니다");
      bookmarkCheckQuery.refetch();
    },
  });

  const bookmarkCheckQuery = trpc.bookmarks.check.useQuery(
    { videoIds: (playlistVideosQuery.data?.items ?? []).map((s) => s.videoId) },
    { enabled: (playlistVideosQuery.data?.items ?? []).length > 0 },
  );
  const bookmarkedSet = new Set(bookmarkCheckQuery.data?.bookmarkedIds ?? []);

  const createMutation = trpc.playlists.create.useMutation({
    onSuccess: () => {
      toast.success("재생목록이 생성되었습니다");
      playlistsQuery.refetch();
      setCreateDialog(false);
      setNewName("");
      setNewDescription("");
    },
    onError: (error) => toast.error(error.message),
  });

  const updateMutation = trpc.playlists.update.useMutation({
    onSuccess: () => {
      toast.success("재생목록이 수정되었습니다");
      playlistsQuery.refetch();
      setEditDialog(null);
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteMutation = trpc.playlists.delete.useMutation({
    onSuccess: () => {
      toast.success("재생목록이 삭제되었습니다");
      playlistsQuery.refetch();
      if (selectedPlaylist) setSelectedPlaylist(null);
    },
    onError: (error) => toast.error(error.message),
  });

  const removeVideoMutation = trpc.playlists.removeVideo.useMutation({
    onSuccess: () => {
      toast.success("영상이 재생목록에서 제거되었습니다");
      playlistVideosQuery.refetch();
      playlistsQuery.refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const summaryDeleteMutation = trpc.summaries.delete.useMutation({
    onSuccess: () => {
      toast.success("요약이 삭제되었습니다");
      playlistVideosQuery.refetch();
    },
    onError: (error) => toast.error("삭제 실패: " + error.message),
  });

  const playlists = playlistsQuery.data ?? [];

  // Detail view
  if (selectedPlaylist) {
    const items = playlistVideosQuery.data?.items ?? [];
    const total = playlistVideosQuery.data?.total ?? 0;
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
          <Button
            variant="ghost"
            size="sm"
            className="mb-4"
            onClick={() => { setSelectedPlaylist(null); setPage(1); }}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            목록으로 돌아가기
          </Button>
          <h1 className="text-4xl font-bold mb-2">{selectedPlaylist.name}</h1>
          <p className="text-muted-foreground">
            {total > 0 ? `${total}개 영상` : "영상이 없습니다"}
          </p>
        </div>

        {playlistVideosQuery.isLoading ? (
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
                              onClick={() => setPlaylistDialogVideo({ videoId: summary.videoId, title: summary.videoTitle || "" })}
                              title="재생목록에 추가"
                            >
                              <ListPlus className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-orange-500"
                              onClick={() => {
                                if (confirm("이 영상을 재생목록에서 제거하시겠습니까?")) {
                                  removeVideoMutation.mutate({ playlistId: selectedPlaylist.id, videoId: summary.videoId });
                                }
                              }}
                              disabled={removeVideoMutation.isPending}
                              title="재생목록에서 제거"
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
                            </>
                          )}
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
              <ListVideo className="h-16 w-16 mx-auto text-muted-foreground" />
              <div>
                <h3 className="text-xl font-semibold mb-2">이 재생목록에 영상이 없습니다</h3>
                <p className="text-muted-foreground">
                  영상 카드에서 재생목록 아이콘을 클릭하여 영상을 추가하세요
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

        {playlistDialogVideo && (
          <PlaylistAddDialog
            videoId={playlistDialogVideo.videoId}
            videoTitle={playlistDialogVideo.title}
            open={!!playlistDialogVideo}
            onOpenChange={(open) => { if (!open) setPlaylistDialogVideo(null); }}
          />
        )}
      </div>
    );
  }

  // List view
  return (
    <div className="container py-8 max-w-5xl">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">재생목록</h1>
            <p className="text-muted-foreground">커스텀 재생목록으로 영상을 카테고리별로 관리하세요</p>
          </div>
          <Button onClick={() => setCreateDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            새 재생목록
          </Button>
        </div>
      </div>

      {playlistsQuery.isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : playlists.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {playlists.map((playlist) => (
            <Card
              key={playlist.id}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => { setSelectedPlaylist({ id: playlist.id, name: playlist.name }); setPage(1); }}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg truncate">{playlist.name}</CardTitle>
                    {playlist.description && (
                      <CardDescription className="mt-1 line-clamp-2">{playlist.description}</CardDescription>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditDialog({
                          id: playlist.id,
                          name: playlist.name,
                          description: playlist.description || "",
                        });
                      }}
                      title="수정"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`"${playlist.name}" 재생목록을 삭제하시겠습니까?`)) {
                          deleteMutation.mutate({ playlistId: playlist.id });
                        }
                      }}
                      disabled={deleteMutation.isPending}
                      title="삭제"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <ListVideo className="h-4 w-4" />
                  <span>{playlist.videoCount ?? 0}개 영상</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="text-center py-12">
          <CardContent className="space-y-4">
            <ListVideo className="h-16 w-16 mx-auto text-muted-foreground" />
            <div>
              <h3 className="text-xl font-semibold mb-2">아직 재생목록이 없습니다</h3>
              <p className="text-muted-foreground">
                새 재생목록을 만들어 영상을 카테고리별로 관리하세요
              </p>
            </div>
            <Button onClick={() => setCreateDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              첫 재생목록 만들기
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Create Dialog */}
      <Dialog open={createDialog} onOpenChange={setCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>새 재생목록 만들기</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">이름</label>
              <Input
                placeholder="재생목록 이름..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">설명 (선택)</label>
              <Input
                placeholder="재생목록 설명..."
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                className="mt-1"
              />
            </div>
            <Button
              className="w-full"
              onClick={() => createMutation.mutate({ name: newName.trim(), description: newDescription.trim() || undefined })}
              disabled={!newName.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              만들기
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editDialog} onOpenChange={(open) => { if (!open) setEditDialog(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>재생목록 수정</DialogTitle>
          </DialogHeader>
          {editDialog && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">이름</label>
                <Input
                  value={editDialog.name}
                  onChange={(e) => setEditDialog({ ...editDialog, name: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">설명 (선택)</label>
                <Input
                  value={editDialog.description}
                  onChange={(e) => setEditDialog({ ...editDialog, description: e.target.value })}
                  className="mt-1"
                />
              </div>
              <Button
                className="w-full"
                onClick={() => updateMutation.mutate({
                  playlistId: editDialog.id,
                  name: editDialog.name.trim(),
                  description: editDialog.description.trim() || undefined,
                })}
                disabled={!editDialog.name.trim() || updateMutation.isPending}
              >
                {updateMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Edit2 className="mr-2 h-4 w-4" />
                )}
                수정하기
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
