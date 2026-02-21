import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Clock, FileText, Loader2, Search, Trash2, Youtube } from "lucide-react";
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
import { useEffect, useRef, useState } from "react";

export default function Summaries() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const limit = 10;

  const { data, isLoading, refetch } = trpc.summaries.list.useQuery({
    page,
    limit,
    search: search || undefined,
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

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput]);

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

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
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
        <h1 className="text-4xl font-bold mb-2">요약 목록</h1>
        <p className="text-muted-foreground">
          구독 채널의 AI 생성 영상 요약 {total > 0 && <span className="font-medium text-foreground">({total}개)</span>}
        </p>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="영상 제목으로 검색..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {isLoading ? (
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
                            {" \u2022 "}
                          </>
                        )}
                        {new Date(summary.createdAt).toLocaleDateString("ko-KR", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}에 요약됨
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

          {/* Pagination */}
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
            <FileText className="h-16 w-16 mx-auto text-muted-foreground" />
            <div>
              <h3 className="text-xl font-semibold mb-2">
                {search ? "검색 결과가 없습니다" : "아직 요약이 없습니다"}
              </h3>
              <p className="text-muted-foreground">
                {search
                  ? "다른 검색어를 입력해보세요"
                  : "채널을 구독하면 새 영상의 요약이 여기에 표시됩니다"}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
