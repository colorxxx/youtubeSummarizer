import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Clock, FileText, Loader2, Trash2, Youtube } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatDuration } from "@/lib/utils";
import { Streamdown } from "streamdown";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Summaries() {
  const { user } = useAuth();
  const { data: summaries, isLoading, refetch } = trpc.summaries.list.useQuery();
  const { data: videos } = trpc.videos.recent.useQuery();
  const deleteMutation = trpc.summaries.delete.useMutation({
    onSuccess: () => {
      toast.success("요약이 삭제되었습니다");
      refetch();
    },
    onError: (error) => {
      toast.error("삭제 실패: " + error.message);
    },
  });

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>Please log in to view your summaries</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Create a map of videoId to video details
  const videoMap = new Map(videos?.map((v) => [v.videoId, v]) || []);

  return (
    <div className="container py-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Video Summaries</h1>
        <p className="text-muted-foreground">AI-generated summaries of videos from your subscribed channels</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : summaries && summaries.length > 0 ? (
        <div className="space-y-6">
          {summaries.map((summary) => {
            const video = videoMap.get(summary.videoId);
            return (
              <Card key={summary.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                <CardHeader className="pb-4">
                  <div className="flex gap-4">
                    {video?.thumbnailUrl ? (
                      <img
                        src={video.thumbnailUrl}
                        alt={video.title}
                        className="w-48 h-27 object-cover rounded-lg flex-shrink-0"
                      />
                    ) : (
                      <div className="w-48 h-27 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Youtube className="h-12 w-12 text-primary" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-xl mb-2">
                          {video ? (
                            <a
                              href={`https://youtube.com/watch?v=${summary.videoId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-primary transition-colors"
                            >
                              {video.title}
                            </a>
                          ) : (
                            summary.videoId
                          )}
                        </CardTitle>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 flex-shrink-0 text-muted-foreground hover:text-destructive"
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
                      <CardDescription>
                        {video && (
                          <>
                            {video.duration && (
                              <>
                                <Clock className="inline h-3.5 w-3.5 mr-1 align-text-bottom" />
                                {formatDuration(video.duration)}
                                {" • "}
                              </>
                            )}
                            {new Date(video.publishedAt).toLocaleDateString("ko-KR", {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            })}
                            {" • "}
                          </>
                        )}
                        Summarized on {new Date(summary.createdAt).toLocaleDateString()}
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
            );
          })}
        </div>
      ) : (
        <Card className="text-center py-12">
          <CardContent className="space-y-4">
            <FileText className="h-16 w-16 mx-auto text-muted-foreground" />
            <div>
              <h3 className="text-xl font-semibold mb-2">No summaries yet</h3>
              <p className="text-muted-foreground">
                Summaries will appear here once new videos are published from your subscribed channels
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
