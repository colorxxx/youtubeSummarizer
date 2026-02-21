import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Loader2, Plus, Search, Trash2, Youtube, Settings as SettingsIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Subscriptions() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [settingsChannel, setSettingsChannel] = useState<any>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [videoCountInput, setVideoCountInput] = useState<number>(3);
  const [dialogOpen, setDialogOpen] = useState(false);

  const utils = trpc.useUtils();
  const { data: subscriptions, isLoading } = trpc.subscriptions.list.useQuery();

  const removeMutation = trpc.subscriptions.remove.useMutation({
    onSuccess: () => {
      toast.success("구독이 해제되었습니다");
      utils.subscriptions.list.invalidate();
      utils.dashboard.channelSummaries.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const addMutation = trpc.subscriptions.add.useMutation({
    onSuccess: (data) => {
      toast.success(data.message || "채널이 구독되었습니다!");
      utils.subscriptions.list.invalidate();
      utils.dashboard.channelSummaries.invalidate();
      setDialogOpen(false);
      setSearchResults([]);
      setSearchQuery("");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateSettingsMutation = trpc.subscriptions.updateSettings.useMutation({
    onSuccess: () => {
      toast.success("채널 설정이 저장되었습니다");
      utils.subscriptions.list.invalidate();
      setSettingsOpen(false);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    try {
      const results = await utils.client.youtube.searchChannels.query({ query: searchQuery });
      setSearchResults(results);
    } catch (error: any) {
      toast.error(error.message || "채널 검색에 실패했습니다");
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddChannel = (channel: any) => {
    addMutation.mutate({
      channelId: channel.id,
      channelName: channel.title,
      channelThumbnail: channel.thumbnail,
    });
  };

  const handleRemoveChannel = (channelId: string) => {
    removeMutation.mutate({ channelId });
  };

  const handleUpdateSettings = () => {
    if (!settingsChannel) return;
    updateSettingsMutation.mutate({
      channelId: settingsChannel.channelId,
      videoCount: videoCountInput,
    });
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>로그인 필요</CardTitle>
            <CardDescription>구독을 관리하려면 로그인해주세요</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <>
      <div className="container py-8 max-w-6xl">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">내 구독 채널</h1>
            <p className="text-muted-foreground">유튜브 채널 구독을 관리하세요</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="lg">
                <Plus className="mr-2 h-5 w-5" />
                채널 추가
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>유튜브 채널 추가</DialogTitle>
                <DialogDescription>구독할 채널을 검색하세요</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="채널 이름으로 검색..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  />
                  <Button onClick={handleSearch} disabled={isSearching}>
                    {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </Button>
                </div>

                {searchResults.length > 0 && (
                  <div className="space-y-3">
                    {searchResults.map((channel) => (
                      <div key={channel.id} className="flex items-center gap-4 p-3 border rounded-lg hover:bg-accent">
                        <img src={channel.thumbnail} alt={channel.title} className="w-16 h-16 rounded-full object-cover" />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold truncate">{channel.title}</h4>
                          <p className="text-sm text-muted-foreground truncate">{channel.description}</p>
                        </div>
                        <Button onClick={() => handleAddChannel(channel)} disabled={addMutation.isPending}>
                          {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : subscriptions && subscriptions.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {subscriptions.map((sub) => (
              <Card key={sub.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                <CardHeader className="pb-4">
                  <div className="flex items-start gap-4">
                    {sub.channelThumbnail ? (
                      <img src={sub.channelThumbnail} alt={sub.channelName} className="w-16 h-16 rounded-full object-cover" />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                        <Youtube className="h-8 w-8 text-primary" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg truncate">{sub.channelName}</CardTitle>
                      <CardDescription className="text-xs">
                        Added {new Date(sub.addedAt).toLocaleDateString()}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      setSettingsChannel(sub);
                      setVideoCountInput(sub.videoCount || 3);
                      setSettingsOpen(true);
                    }}
                  >
                    <SettingsIcon className="h-4 w-4 mr-2" />
                    설정 ({sub.videoCount || 3}개 영상)
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full"
                    onClick={() => handleRemoveChannel(sub.channelId)}
                    disabled={removeMutation.isPending}
                  >
                    {removeMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Trash2 className="h-4 w-4 mr-2" />
                    )}
                    구독 해제
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="text-center py-12">
            <CardContent className="space-y-4">
              <Youtube className="h-16 w-16 mx-auto text-muted-foreground" />
              <div>
                <h3 className="text-xl font-semibold mb-2">아직 구독 중인 채널이 없습니다</h3>
                <p className="text-muted-foreground mb-6">좋아하는 유튜브 채널을 추가해보세요</p>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="lg">
                      <Plus className="mr-2 h-5 w-5" />
                      첫 채널 추가하기
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Add YouTube Channel</DialogTitle>
                      <DialogDescription>Search for a channel to subscribe</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="flex gap-2">
                        <Input
                          placeholder="채널 이름으로 검색..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                        />
                        <Button onClick={handleSearch} disabled={isSearching}>
                          {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                        </Button>
                      </div>

                      {searchResults.length > 0 && (
                        <div className="space-y-3">
                          {searchResults.map((channel) => (
                            <div key={channel.id} className="flex items-center gap-4 p-3 border rounded-lg hover:bg-accent">
                              <img src={channel.thumbnail} alt={channel.title} className="w-16 h-16 rounded-full object-cover" />
                              <div className="flex-1 min-w-0">
                                <h4 className="font-semibold truncate">{channel.title}</h4>
                                <p className="text-sm text-muted-foreground truncate">{channel.description}</p>
                              </div>
                              <Button onClick={() => handleAddChannel(channel)} disabled={addMutation.isPending}>
                                {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Channel Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>채널 설정</DialogTitle>
            <DialogDescription>
              {settingsChannel?.channelName}의 요약할 최근 영상 수를 설정하세요
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="videoCount">요약할 영상 수</Label>
              <Select
                value={videoCountInput.toString()}
                onValueChange={(value) => setVideoCountInput(parseInt(value))}
              >
                <SelectTrigger id="videoCount">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                    <SelectItem key={num} value={num.toString()}>
                      {num}개
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                새 영상이 게시되면 최근 {videoCountInput}개가 요약됩니다
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setSettingsOpen(false)}>
              취소
            </Button>
            <Button onClick={handleUpdateSettings} disabled={updateSettingsMutation.isPending}>
              {updateSettingsMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              저장
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
