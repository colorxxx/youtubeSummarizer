import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Edit2, ListVideo, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useState } from "react";
import { VideoChatSheet } from "@/components/VideoChatSheet";
import { PlaylistAddDialog } from "@/components/PlaylistAddDialog";
import { VideoSummaryCard } from "@/components/VideoSummaryCard";
import { PaginationBar } from "@/components/PaginationBar";

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

  const playlists = playlistsQuery.data ?? [];

  // Detail view
  if (selectedPlaylist) {
    const items = playlistVideosQuery.data?.items ?? [];
    const total = playlistVideosQuery.data?.total ?? 0;
    const totalPages = Math.ceil(total / limit);

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
                <VideoSummaryCard
                  key={summary.id}
                  data={summary}
                  bookmarked={bookmarkedSet.has(summary.videoId)}
                  onChat={() => setChatVideo({ videoId: summary.videoId, title: summary.videoTitle || "" })}
                  onBookmark={() => bookmarkMutation.mutate({ videoId: summary.videoId })}
                  onPlaylistAdd={() => setPlaylistDialogVideo({ videoId: summary.videoId, title: summary.videoTitle || "" })}
                  isBookmarkPending={bookmarkMutation.isPending}
                  isDeletePending={removeVideoMutation.isPending}
                  showSummarizedDate={false}
                  extraActions={
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
                  }
                />
              ))}
            </div>

            <PaginationBar page={page} totalPages={totalPages} onPageChange={setPage} />
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
