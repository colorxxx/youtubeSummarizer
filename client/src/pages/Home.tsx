import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Youtube, Sparkles, ArrowRight, BookOpen } from "lucide-react";
import { getLoginUrl } from "@/const";
import { Link } from "wouter";

export default function Home() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <Youtube className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold">YouTube 요약</span>
          </div>
          <div className="flex items-center gap-4">
            {user ? (
              <Link href="/summaries">
                <Button>요약 보러가기</Button>
              </Link>
            ) : (
              <Button onClick={() => window.location.href = getLoginUrl()}>로그인</Button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 md:py-32 bg-gradient-to-b from-background to-muted/20">
        <div className="container">
          <div className="flex flex-col items-center text-center space-y-8 max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
              <Sparkles className="h-4 w-4" />
              AI가 영상을 요약해드려요
            </div>
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
              유튜브 영상,
              <br />
              <span className="text-primary">읽으면 끝!</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl">
              좋아하는 유튜브 채널을 등록하면 새 영상이 올라올 때마다
              AI가 자동으로 핵심 내용을 요약해드립니다.
            </p>
            <div className="flex gap-4">
              {user ? (
                <Link href="/summaries">
                  <Button size="lg" className="text-lg px-8">
                    요약 보러가기
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              ) : (
                <Button size="lg" className="text-lg px-8" onClick={() => window.location.href = getLoginUrl()}>
                  무료로 시작하기
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-background">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">이렇게 사용해요</h2>
            <p className="text-muted-foreground text-lg">간단한 3단계로 영상 요약을 받아보세요</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card>
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Youtube className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>채널 구독</CardTitle>
                <CardDescription>
                  좋아하는 유튜브 채널을 검색하고 구독하세요. 몇 초면 끝납니다.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>AI 자동 요약</CardTitle>
                <CardDescription>
                  새 영상이 올라오면 AI가 자동으로 핵심 내용을 간단하게 정리해드립니다.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <BookOpen className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>요약 확인</CardTitle>
                <CardDescription>
                  간단 요약과 상세 요약을 한눈에 확인하세요. 긴 영상도 빠르게 파악할 수 있습니다.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-muted/30">
        <div className="container">
          <Card className="border-2 border-primary/20">
            <CardContent className="py-12">
              <div className="flex flex-col items-center text-center space-y-6 max-w-2xl mx-auto">
                <h2 className="text-3xl md:text-4xl font-bold">지금 바로 시작해보세요</h2>
                <p className="text-lg text-muted-foreground">
                  Google 계정으로 간편하게 로그인하고 유튜브 영상 요약을 받아보세요.
                </p>
                {user ? (
                  <Link href="/subscriptions">
                    <Button size="lg" className="text-lg px-8">
                      첫 채널 등록하기
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </Link>
                ) : (
                  <Button size="lg" className="text-lg px-8" onClick={() => window.location.href = getLoginUrl()}>
                    Google로 시작하기
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 bg-background">
        <div className="container">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <Youtube className="h-6 w-6 text-primary" />
              <span className="font-semibold">YouTube 요약</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
