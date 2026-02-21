import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { ChevronDown, Youtube, Clock, Loader2, RefreshCw, Trash2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Streamdown } from "streamdown";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { formatDuration } from "@/lib/utils";
import { useBackgroundTasks } from "@/hooks/useBackgroundTasks";
import { VideoChatSheet } from "@/components/VideoChatSheet";

export default function Dashboard() {
  const { data: channelData, isLoading, refetch } = trpc.dashboard.channelSummaries.useQuery();
  const [openChannels, setOpenChannels] = useState<Set<string>>(new Set());
  const { getTaskForChannel } = useBackgroundTasks();
  const deleteMutation = trpc.summaries.delete.useMutation({
    onSuccess: () => {
      toast.success("요약이 삭제되었습니다");
      refetch();
    },
    onError: (error) => {
      toast.error("삭제 실패: " + error.message);
    },
  });
  const refreshMutation = trpc.dashboard.refreshVideos.useMutation({
    onSuccess: (data) => {
      toast.success(data.message || `Found ${data.newVideos} new videos`);
      refetch();
    },
    onError: (error) => {
      toast.error("Failed to check for new videos: " + error.message);
    },
  });
  const [chatVideo, setChatVideo] = useState<{ videoId: string; title: string } | null>(null);
  const [refreshingChannelId, setRefreshingChannelId] = useState<string | null>(null);
  const refreshChannelMutation = trpc.dashboard.refreshChannel.useMutation({
    onSuccess: (data) => {
      toast.info(data.message || "백그라운드에서 처리 중...");
      setRefreshingChannelId(null);
      // Refetch is handled by background task completion
    },
    onError: (error) => {
      toast.error("채널 새로고침 실패: " + error.message);
      setRefreshingChannelId(null);
    },
  });

  const toggleChannel = (channelId: string) => {
    setOpenChannels((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(channelId)) {
        newSet.delete(channelId);
      } else {
        newSet.add(channelId);
      }
      return newSet;
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const allChannels = channelData || [];

  return (
    <div className="container py-6 md:py-8">
      <div className="mb-6 md:mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-2">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">대시보드</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-2">
              채널별로 정리된 AI 요약을 확인하세요
            </p>
          </div>
          <Button
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
            className="w-full sm:w-auto"
          >
            {refreshMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                확인 중...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                새 영상 확인
              </>
            )}
          </Button>
        </div>
      </div>

      {allChannels.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center">
            <Youtube className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              아직 요약이 없습니다. 채널을 구독하면 여기에 요약이 표시됩니다!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {allChannels.map((item) => (
            <Collapsible
              key={item.channel.channelId}
              open={openChannels.has(item.channel.channelId)}
              onOpenChange={() => toggleChannel(item.channel.channelId)}
            >
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
                    <div className="flex items-center gap-3 md:gap-4">
                      {item.channel.channelThumbnail && (
                        <img
                          src={item.channel.channelThumbnail}
                          alt={item.channel.channelName}
                          className="w-12 h-12 md:w-16 md:h-16 rounded-full flex-shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg md:text-xl truncate">{item.channel.channelName}</CardTitle>
                        <CardDescription className="text-xs md:text-sm">
                          {item.summaries.length > 0
                            ? `${item.summaries.length}개 영상 요약됨`
                            : "요약 없음"}
                        </CardDescription>
                      </div>
                      {(() => {
                        const task = getTaskForChannel(item.channel.channelId);
                        if (task) {
                          return (
                            <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded-full flex items-center gap-1 flex-shrink-0">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              {task.processedVideos}/{task.totalVideos}
                            </span>
                          );
                        }
                        return (
                          <button
                            className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                            disabled={refreshingChannelId === item.channel.channelId}
                            onClick={(e) => {
                              e.stopPropagation();
                              setRefreshingChannelId(item.channel.channelId);
                              refreshChannelMutation.mutate({ channelId: item.channel.channelId, channelName: item.channel.channelName });
                            }}
                            title="채널 새로고침"
                          >
                            {refreshingChannelId === item.channel.channelId ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4" />
                            )}
                          </button>
                        );
                      })()}
                      <ChevronDown
                        className={`h-5 w-5 transition-transform flex-shrink-0 ${
                          openChannels.has(item.channel.channelId) ? "rotate-180" : ""
                        }`}
                      />
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  {item.summaries.length === 0 ? (
                    <CardContent className="py-8 text-center text-muted-foreground">
                      요약 없음
                    </CardContent>
                  ) : (
                    <CardContent className="space-y-4 md:space-y-6 pt-4">
                      {item.summaries.map((summary) => (
                      <Card key={summary.videoId} className="border-2">
                        <CardHeader className="pb-3">
                          <div className="flex flex-col md:flex-row gap-3 md:gap-4">
                            {summary.video?.thumbnailUrl && (
                              <img
                                src={summary.video.thumbnailUrl}
                                alt={summary.video.title}
                                className="w-full md:w-48 h-auto md:h-27 object-cover rounded-lg flex-shrink-0"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <CardTitle className="text-base md:text-lg mb-2">
                                  <a
                                    href={`https://youtube.com/watch?v=${summary.videoId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hover:text-primary transition-colors break-words"
                                  >
                                    {summary.video?.title}
                                  </a>
                                </CardTitle>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-primary"
                                    onClick={() => setChatVideo({ videoId: summary.videoId, title: summary.video?.title || "" })}
                                    title="AI 채팅"
                                  >
                                    <MessageCircle className="h-4 w-4" />
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
                              <div className="flex flex-wrap items-center gap-2 md:gap-4 text-xs md:text-sm text-muted-foreground">
                                {summary.video?.duration && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3 md:h-4 md:w-4" />
                                    {formatDuration(summary.video.duration)}
                                  </span>
                                )}
                                {summary.createdAt && (
                                  <span>
                                    {formatDistanceToNow(new Date(summary.createdAt), { addSuffix: true })}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <Tabs defaultValue="brief" className="w-full">
                            <TabsList className="grid w-full grid-cols-2">
                              <TabsTrigger value="brief" className="text-xs md:text-sm">간단 요약</TabsTrigger>
                              <TabsTrigger value="detailed" className="text-xs md:text-sm">상세 요약</TabsTrigger>
                            </TabsList>
                            <TabsContent value="brief" className="mt-4">
                              <div className="prose prose-sm max-w-none text-sm md:text-base">
                                <Streamdown>{summary.summary}</Streamdown>
                              </div>
                            </TabsContent>
                            <TabsContent value="detailed" className="mt-4">
                              <div className="prose prose-sm max-w-none text-sm md:text-base">
                                <Streamdown>{summary.detailedSummary || summary.summary}</Streamdown>
                              </div>
                            </TabsContent>
                          </Tabs>
                        </CardContent>
                      </Card>
                      ))}
                    </CardContent>
                  )}
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))}
        </div>
      )}

      {chatVideo && (
        <VideoChatSheet
          videoId={chatVideo.videoId}
          videoTitle={chatVideo.title}
          open={!!chatVideo}
          onOpenChange={(open) => { if (!open) setChatVideo(null); }}
        />
      )}
    </div>
  );
}
