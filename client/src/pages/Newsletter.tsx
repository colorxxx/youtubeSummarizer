import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { ExternalLink, Loader2, Mail, Newspaper, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Streamdown } from "streamdown";
import { format } from "date-fns";
import type { NewsletterData, NewsletterVideo } from "@shared/types";

function formatWeekRange(weekStart: Date, weekEnd: Date) {
  const start = new Date(weekStart);
  const end = new Date(new Date(weekEnd).getTime() - 1);
  return `${format(start, "M월 d일")} ~ ${format(end, "M월 d일")}`;
}

function thumbnail(video: NewsletterVideo): string {
  return video.thumbnailUrl || `https://i.ytimg.com/vi/${video.videoId}/mqdefault.jpg`;
}

function videoUrl(video: NewsletterVideo): string {
  return `https://www.youtube.com/watch?v=${video.videoId}`;
}

/** Cover collage built from the week's actual video thumbnails */
function IssueCover({
  title,
  weekLabel,
  videos,
}: {
  title: string;
  weekLabel: string;
  videos: NewsletterVideo[];
}) {
  const coverThumbs = videos.slice(0, 8);
  return (
    <div className="relative overflow-hidden rounded-xl bg-zinc-900">
      <div className="absolute inset-0 grid grid-cols-4 opacity-40 blur-[2px] scale-105">
        {coverThumbs.map((v) => (
          <img
            key={v.videoId}
            src={thumbnail(v)}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ))}
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/70 to-zinc-900/30" />
      <div className="relative px-6 py-10 sm:px-10 sm:py-12">
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-red-400">
          AI 동향 위클리
        </div>
        <h2 className="mt-2 max-w-3xl text-2xl font-bold leading-snug text-white sm:text-3xl">
          {title}
        </h2>
        <div className="mt-3 text-sm text-zinc-300">
          {weekLabel} · 영상 {videos.length}개
        </div>
      </div>
    </div>
  );
}

function TrendThumbs({
  videoIds,
  videoMap,
}: {
  videoIds: string[];
  videoMap: Map<string, NewsletterVideo>;
}) {
  const trendVideos = videoIds
    .map((id) => videoMap.get(id))
    .filter((v): v is NewsletterVideo => Boolean(v))
    .slice(0, 4);

  if (trendVideos.length === 0) return null;

  return (
    <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
      {trendVideos.map((v) => (
        <a
          key={v.videoId}
          href={videoUrl(v)}
          target="_blank"
          rel="noreferrer"
          className="group w-44 shrink-0"
          title={v.title}
        >
          <img
            src={thumbnail(v)}
            alt={v.title}
            loading="lazy"
            className="aspect-video w-full rounded-lg object-cover transition-transform group-hover:scale-[1.03]"
          />
          <div className="mt-1.5 line-clamp-2 text-xs leading-snug text-muted-foreground group-hover:text-foreground">
            {v.title}
          </div>
        </a>
      ))}
    </div>
  );
}

function VideoCard({ video }: { video: NewsletterVideo }) {
  return (
    <a
      href={videoUrl(video)}
      target="_blank"
      rel="noreferrer"
      className="group flex flex-col overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md"
    >
      <div className="relative overflow-hidden">
        <img
          src={thumbnail(video)}
          alt={video.title}
          loading="lazy"
          className="aspect-video w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
        />
        <div className="absolute right-2 top-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] text-white opacity-0 transition-opacity group-hover:opacity-100">
          <ExternalLink className="h-3 w-3" />
        </div>
      </div>
      <div className="flex flex-1 flex-col p-3">
        <div className="line-clamp-2 text-sm font-semibold leading-snug group-hover:text-red-600">
          {video.title}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          {format(new Date(video.publishedAt), "M월 d일")}
        </div>
        <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
          {video.summary}
        </p>
      </div>
    </a>
  );
}

function RichIssue({
  title,
  weekLabel,
  data,
}: {
  title: string;
  weekLabel: string;
  data: NewsletterData;
}) {
  const videoMap = useMemo(
    () => new Map(data.videos.map((v) => [v.videoId, v])),
    [data.videos],
  );

  const byChannel = useMemo(() => {
    const map = new Map<string, NewsletterVideo[]>();
    for (const v of data.videos) {
      if (!map.has(v.channelId)) map.set(v.channelId, []);
      map.get(v.channelId)!.push(v);
    }
    return Array.from(map.values()).sort((a, b) => b.length - a.length);
  }, [data.videos]);

  return (
    <div className="space-y-8">
      <IssueCover title={title} weekLabel={weekLabel} videos={data.videos} />

      <section className="rounded-xl border-l-4 border-red-600 bg-red-50/60 p-5 dark:bg-red-950/20">
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-red-700 dark:text-red-400">
          이번 주 한눈에
        </h3>
        <ul className="space-y-2">
          {data.tldr.map((point, i) => (
            <li key={i} className="flex gap-2.5 text-sm leading-relaxed">
              <span className="font-bold text-red-600">›</span>
              <span>{point}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="mb-5 border-b-2 border-foreground pb-2 text-lg font-bold">
          주요 트렌드
        </h3>
        <div className="space-y-7">
          {data.trends.map((trend, i) => (
            <div key={i}>
              <h4 className="text-base font-semibold">{trend.heading}</h4>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {trend.body}
              </p>
              <TrendThumbs videoIds={trend.videoIds} videoMap={videoMap} />
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-5 border-b-2 border-foreground pb-2 text-lg font-bold">
          채널별 하이라이트
        </h3>
        <div className="space-y-8">
          {byChannel.map((channelVideos) => (
            <div key={channelVideos[0].channelId}>
              <div className="mb-3 flex items-baseline gap-2">
                <h4 className="text-base font-semibold">
                  {channelVideos[0].channelName}
                </h4>
                <span className="text-xs text-muted-foreground">
                  {channelVideos.length}개
                </span>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {channelVideos.map((v) => (
                  <VideoCard key={v.videoId} video={v} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default function Newsletter() {
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data: issues, isLoading, refetch } = trpc.newsletters.list.useQuery();

  const activeId = selectedId ?? issues?.[0]?.id ?? null;

  const { data: issue, isLoading: isIssueLoading } = trpc.newsletters.get.useQuery(
    { id: activeId! },
    { enabled: activeId !== null },
  );

  const issueData = useMemo<NewsletterData | null>(() => {
    if (!issue?.data) return null;
    try {
      return JSON.parse(issue.data) as NewsletterData;
    } catch {
      return null;
    }
  }, [issue]);

  const generateMutation = trpc.newsletters.generate.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(result.message);
        refetch();
        if (result.id) setSelectedId(result.id);
      } else {
        toast.info(result.message);
      }
    },
    onError: (error) => {
      toast.error("생성 실패: " + error.message);
    },
  });

  const sendEmailMutation = trpc.newsletters.sendEmail.useMutation({
    onSuccess: (result) => {
      toast.success(result.message);
    },
    onError: (error) => {
      toast.error("발송 실패: " + error.message);
    },
  });

  return (
    <div className="container py-8 max-w-6xl">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold mb-2">AI 동향 뉴스레터</h1>
          <p className="text-muted-foreground">
            AI 채널들의 한 주간 요약을 모아 만든 위클리 다이제스트
            {issues && issues.length > 0 && (
              <span className="font-medium text-foreground"> ({issues.length}호)</span>
            )}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => generateMutation.mutate({})}
          disabled={generateMutation.isPending}
        >
          {generateMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          지난주 호 생성
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !issues || issues.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Newspaper className="h-10 w-10 mx-auto mb-4 opacity-50" />
            <p>아직 발행된 뉴스레터가 없습니다.</p>
            <p className="text-sm mt-1">"지난주 호 생성" 버튼으로 첫 호를 만들어보세요.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
          {/* Issue list */}
          <div className="flex gap-2 overflow-x-auto pb-2 lg:block lg:max-h-[80vh] lg:space-y-2 lg:overflow-y-auto lg:pb-0 lg:pr-1">
            {issues.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                className={`w-64 shrink-0 rounded-lg border p-3 text-left transition-colors lg:w-full ${
                  item.id === activeId
                    ? "border-red-600/50 bg-red-50/50 dark:bg-red-950/20"
                    : "hover:bg-muted/50"
                }`}
              >
                <div className="text-xs text-muted-foreground mb-1">
                  {formatWeekRange(item.weekStart, item.weekEnd)}
                </div>
                <div className="text-sm font-medium line-clamp-2">{item.title}</div>
                <div className="mt-1.5 flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    영상 {item.videoCount}개
                  </Badge>
                  {item.emailSentAt && (
                    <Badge variant="outline" className="text-xs">
                      <Mail className="h-3 w-3 mr-1" />
                      발송됨
                    </Badge>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Issue content */}
          <div className="min-w-0">
            {isIssueLoading || !issue ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => sendEmailMutation.mutate({ id: issue.id })}
                    disabled={sendEmailMutation.isPending}
                  >
                    {sendEmailMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Mail className="h-4 w-4 mr-2" />
                    )}
                    이메일로 받기
                  </Button>
                </div>
                {issueData ? (
                  <RichIssue
                    title={issue.title}
                    weekLabel={formatWeekRange(issue.weekStart, issue.weekEnd)}
                    data={issueData}
                  />
                ) : (
                  <Card>
                    <CardContent className="py-6">
                      <h2 className="mb-4 text-2xl font-bold">{issue.title}</h2>
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <Streamdown>{issue.content}</Streamdown>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
