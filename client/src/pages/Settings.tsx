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
      toast.success("Settings saved successfully");
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
      toast.error("Please enter a valid email address");
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
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>Please log in to access settings</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Settings</h1>
        <p className="text-muted-foreground">Manage your email preferences and notification settings</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Email Settings</CardTitle>
              <CardDescription>Configure where you want to receive your video summaries</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  Daily summaries will be sent to this email address
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="email-enabled">Enable Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive email summaries of new videos from your subscriptions
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
              <CardTitle>Summary Frequency</CardTitle>
              <CardDescription>Choose how often you want to receive video summaries</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="frequency">Delivery Frequency</Label>
                <Select value={summaryFrequency} onValueChange={(value: "daily" | "weekly") => setSummaryFrequency(value)}>
                  <SelectTrigger id="frequency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  {summaryFrequency === "daily" 
                    ? "You'll receive a summary email every day with new videos from the past 24 hours"
                    : "You'll receive a summary email every week with new videos from the past 7 days"}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Video Count</CardTitle>
              <CardDescription>Number of recent videos to summarize when subscribing to a channel</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="video-count">Videos per Channel</Label>
                <Select value={videoCount.toString()} onValueChange={(value) => setVideoCount(parseInt(value))}>
                  <SelectTrigger id="video-count">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 video</SelectItem>
                    <SelectItem value="2">2 videos</SelectItem>
                    <SelectItem value="3">3 videos</SelectItem>
                    <SelectItem value="4">4 videos</SelectItem>
                    <SelectItem value="5">5 videos</SelectItem>
                    <SelectItem value="6">6 videos</SelectItem>
                    <SelectItem value="7">7 videos</SelectItem>
                    <SelectItem value="8">8 videos</SelectItem>
                    <SelectItem value="9">9 videos</SelectItem>
                    <SelectItem value="10">10 videos</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  When you subscribe to a new channel, the {videoCount} most recent video{videoCount > 1 ? 's' : ''} will be automatically summarized
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
              <CardDescription>Your account details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Name</Label>
                  <p className="font-medium">{user.name || "Not set"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Login Method</Label>
                  <p className="font-medium capitalize">{user.loginMethod || "Unknown"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button size="lg" onClick={handleSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-5 w-5" />
                  Save Settings
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
