import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface PlaylistAddDialogProps {
  videoId: string;
  videoTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PlaylistAddDialog({ videoId, videoTitle, open, onOpenChange }: PlaylistAddDialogProps) {
  const [newPlaylistName, setNewPlaylistName] = useState("");

  const playlistsQuery = trpc.playlists.list.useQuery(undefined, { enabled: open });
  const videoPlaylistsQuery = trpc.playlists.videoPlaylists.useQuery(
    { videoId },
    { enabled: open },
  );

  const addVideoMutation = trpc.playlists.addVideo.useMutation({
    onSuccess: () => {
      videoPlaylistsQuery.refetch();
      toast.success("재생목록에 추가되었습니다");
    },
    onError: (error) => toast.error(error.message),
  });

  const removeVideoMutation = trpc.playlists.removeVideo.useMutation({
    onSuccess: () => {
      videoPlaylistsQuery.refetch();
      toast.success("재생목록에서 제거되었습니다");
    },
    onError: (error) => toast.error(error.message),
  });

  const createPlaylistMutation = trpc.playlists.create.useMutation({
    onSuccess: (newPlaylist) => {
      playlistsQuery.refetch();
      setNewPlaylistName("");
      toast.success("재생목록이 생성되었습니다");
      // Auto-add video to new playlist
      if (newPlaylist?.id) {
        addVideoMutation.mutate({ playlistId: newPlaylist.id, videoId });
      }
    },
    onError: (error) => toast.error(error.message),
  });

  const videoPlaylistIds = new Set(videoPlaylistsQuery.data ?? []);
  const playlists = playlistsQuery.data ?? [];

  const handleTogglePlaylist = (playlistId: number) => {
    if (videoPlaylistIds.has(playlistId)) {
      removeVideoMutation.mutate({ playlistId, videoId });
    } else {
      addVideoMutation.mutate({ playlistId, videoId });
    }
  };

  const handleCreatePlaylist = () => {
    const name = newPlaylistName.trim();
    if (!name) return;
    createPlaylistMutation.mutate({ name });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>재생목록에 추가</DialogTitle>
          <DialogDescription className="truncate">
            {videoTitle}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {playlistsQuery.isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : playlists.length > 0 ? (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {playlists.map((playlist) => (
                <label
                  key={playlist.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent cursor-pointer transition-colors"
                >
                  <Checkbox
                    checked={videoPlaylistIds.has(playlist.id)}
                    onCheckedChange={() => handleTogglePlaylist(playlist.id)}
                    disabled={addVideoMutation.isPending || removeVideoMutation.isPending}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{playlist.name}</p>
                    {playlist.videoCount !== undefined && (
                      <p className="text-xs text-muted-foreground">{playlist.videoCount}개 영상</p>
                    )}
                  </div>
                </label>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-2">
              아직 재생목록이 없습니다
            </p>
          )}

          {/* Create new playlist */}
          <div className="border-t pt-4">
            <p className="text-sm font-medium mb-2">새 재생목록 만들기</p>
            <div className="flex gap-2">
              <Input
                placeholder="재생목록 이름..."
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleCreatePlaylist();
                  }
                }}
                className="flex-1"
              />
              <Button
                size="sm"
                onClick={handleCreatePlaylist}
                disabled={!newPlaylistName.trim() || createPlaylistMutation.isPending}
              >
                {createPlaylistMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
