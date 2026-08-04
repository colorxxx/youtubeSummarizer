import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Loader2, Mail, Newspaper, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Streamdown } from "streamdown";
import { format } from "date-fns";

function formatWeekRange(weekStart: Date, weekEnd: Date) {
  const start = new Date(weekStart);
  const end = new Date(new Date(weekEnd).getTime() - 1);
  return `${format(start, "M월 d일")} ~ ${format(end, "M월 d일")}`;
}

export default function Newsletter() {
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data: issues, isLoading, refetch } = trpc.newsletters.list.useQuery();

  const activeId = selectedId ?? issues?.[0]?.id ?? null;

  const { data: issue, isLoading: isIssueLoading } = trpc.newsletters.get.useQuery(
    { id: activeId! },
    { enabled: activeId !== null },
  );

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
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
          {/* Issue list */}
          <div className="space-y-2 lg:max-h-[75vh] lg:overflow-y-auto lg:pr-1">
            {issues.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                className={`w-full text-left rounded-lg border p-3 transition-colors ${
                  item.id === activeId
                    ? "border-primary bg-primary/5"
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
          <Card className="min-w-0">
            <CardContent className="py-6">
              {isIssueLoading || !issue ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
                    <h2 className="text-2xl font-bold flex-1 min-w-[200px]">{issue.title}</h2>
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
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <Streamdown>{issue.content}</Streamdown>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
