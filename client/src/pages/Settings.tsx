import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { Loader2, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function Settings() {
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [summaryFrequency, setSummaryFrequency] = useState<"daily" | "weekly">("daily");
  const [videoCount, setVideoCount] = useState(3);

  const { data: settings, isLoading } = trpc.settings.get.useQuery();
  const updateMutation = trpc.settings.update.useMutation({
    onSuccess: () => {
      toast.success("설정이 저장되었습니다");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  useEffect(() => {
    if (settings) {
      setEmail(settings.email);
      setEmailEnabled(settings.emailEnabled === 1);
      setSummaryFrequency(settings.summaryFrequency);
      setVideoCount(settings.videoCount || 3);
    } else if (user?.email) {
      setEmail(user.email);
    }
  }, [settings, user]);

  const handleSave = () => {
    if (!email || !email.includes("@")) {
      toast.error("올바른 이메일 주소를 입력해주세요");
      return;
    }

    updateMutation.mutate({
      email,
      emailEnabled,
      summaryFrequency,
      videoCount,
    });
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>로그인 필요</CardTitle>
            <CardDescription>설정을 변경하려면 로그인해주세요</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">설정</h1>
        <p className="text-muted-foreground">이메일 및 알림 설정을 관리하세요</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>이메일 설정</CardTitle>
              <CardDescription>영상 요약을 받을 이메일을 설정하세요</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email">이메일 주소</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  요약 이메일이 이 주소로 발송됩니다
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="email-enabled">이메일 알림 활성화</Label>
                  <p className="text-sm text-muted-foreground">
                    구독 채널의 새 영상 요약을 이메일로 받습니다
                  </p>
                </div>
                <Switch
                  id="email-enabled"
                  checked={emailEnabled}
                  onCheckedChange={setEmailEnabled}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>요약 빈도</CardTitle>
              <CardDescription>영상 요약을 받을 주기를 선택하세요</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="frequency">발송 주기</Label>
                <Select value={summaryFrequency} onValueChange={(value: "daily" | "weekly") => setSummaryFrequency(value)}>
                  <SelectTrigger id="frequency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">매일</SelectItem>
                    <SelectItem value="weekly">매주</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  {summaryFrequency === "daily"
                    ? "최근 24시간 동안의 새 영상 요약을 매일 받습니다"
                    : "최근 7일간의 새 영상 요약을 매주 받습니다"}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>영상 수</CardTitle>
              <CardDescription>채널 구독 시 요약할 최근 영상 수를 설정하세요</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="video-count">채널당 영상 수</Label>
                <Select value={videoCount.toString()} onValueChange={(value) => setVideoCount(parseInt(value))}>
                  <SelectTrigger id="video-count">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1개</SelectItem>
                    <SelectItem value="2">2개</SelectItem>
                    <SelectItem value="3">3개</SelectItem>
                    <SelectItem value="4">4개</SelectItem>
                    <SelectItem value="5">5개</SelectItem>
                    <SelectItem value="6">6개</SelectItem>
                    <SelectItem value="7">7개</SelectItem>
                    <SelectItem value="8">8개</SelectItem>
                    <SelectItem value="9">9개</SelectItem>
                    <SelectItem value="10">10개</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  새 채널을 구독하면 최근 {videoCount}개 영상이 자동으로 요약됩니다
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>계정 정보</CardTitle>
              <CardDescription>내 계정 정보입니다</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">이름</Label>
                  <p className="font-medium">{user.name || "미설정"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">로그인 방식</Label>
                  <p className="font-medium capitalize">{user.loginMethod || "알 수 없음"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button size="lg" onClick={handleSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  저장 중...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-5 w-5" />
                  설정 저장
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
