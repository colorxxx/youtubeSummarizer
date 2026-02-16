import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Youtube, Mail, Sparkles, ArrowRight } from "lucide-react";
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
            <span className="text-xl font-bold">YouTube Summary Mailer</span>
          </div>
          <div className="flex items-center gap-4">
            {user ? (
              <Link href="/dashboard">
                <Button>Go to Dashboard</Button>
              </Link>
            ) : (
              <Button onClick={() => window.location.href = getLoginUrl()}>Sign In</Button>
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
              AI-Powered Video Summaries
            </div>
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
              Never Miss Important
              <br />
              <span className="text-primary">YouTube Content</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl">
              Get AI-generated summaries of new videos from your favorite YouTube channels delivered straight to your inbox. Stay informed without spending hours watching.
            </p>
            <div className="flex gap-4">
              {user ? (
                <Link href="/dashboard">
                  <Button size="lg" className="text-lg px-8">
                    Go to Dashboard
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              ) : (
                <Button size="lg" className="text-lg px-8" onClick={() => window.location.href = getLoginUrl()}>
                  Get Started Free
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
            <h2 className="text-3xl md:text-4xl font-bold mb-4">How It Works</h2>
            <p className="text-muted-foreground text-lg">Three simple steps to stay updated</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card>
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Youtube className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Subscribe to Channels</CardTitle>
                <CardDescription>
                  Add your favorite YouTube channels to track. Search and subscribe in seconds.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>AI Summarization</CardTitle>
                <CardDescription>
                  Our AI automatically generates concise summaries of new videos, highlighting key points and insights.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Mail className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Email Delivery</CardTitle>
                <CardDescription>
                  Receive daily or weekly email digests with summaries of all new videos from your subscriptions.
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
                <h2 className="text-3xl md:text-4xl font-bold">Ready to Get Started?</h2>
                <p className="text-lg text-muted-foreground">
                  Join now and start receiving AI-powered summaries of your favorite YouTube content.
                </p>
                {user ? (
                  <Link href="/subscriptions">
                    <Button size="lg" className="text-lg px-8">
                      Add Your First Channel
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </Link>
                ) : (
                  <Button size="lg" className="text-lg px-8" onClick={() => window.location.href = getLoginUrl()}>
                    Sign Up Now
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
              <span className="font-semibold">YouTube Summary Mailer</span>
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
