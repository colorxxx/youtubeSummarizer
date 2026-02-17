import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

export function BackgroundTasksBar() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const previousTasksRef = useRef<Map<string, string>>(new Map());

  const { data: tasks } = trpc.backgroundTasks.list.useQuery(undefined, {
    enabled: !!user,
    refetchInterval: 2000, // Poll every 2 seconds
  });

  // Track completion and show toast
  useEffect(() => {
    if (!tasks) return;

    const prevTasks = previousTasksRef.current;

    for (const task of tasks) {
      const prevStatus = prevTasks.get(task.id);

      // Task just completed
      if (prevStatus === "processing" && task.status === "completed") {
        toast.success(`${task.channelName}: 요약 생성 완료!`);
        // Invalidate dashboard data to show new summaries
        utils.dashboard.channelSummaries.invalidate();
      }

      // Task just failed
      if (prevStatus === "processing" && task.status === "failed") {
        toast.error(`${task.channelName}: 요약 생성 실패`);
      }

      prevTasks.set(task.id, task.status);
    }
  }, [tasks, utils]);

  if (!user || !tasks) return null;

  const activeTasks = tasks.filter((t) => t.status === "processing");
  const recentCompletedTasks = tasks
    .filter((t) => t.status === "completed" || t.status === "failed")
    .slice(0, 3);

  if (activeTasks.length === 0 && recentCompletedTasks.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {/* Active tasks */}
      {activeTasks.map((task) => (
        <div
          key={task.id}
          className="bg-primary text-primary-foreground px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-in slide-in-from-bottom-2"
        >
          <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{task.channelName}</div>
            <div className="text-xs opacity-80">
              {task.processedVideos}/{task.totalVideos} 영상 처리 중...
            </div>
          </div>
        </div>
      ))}

      {/* Recently completed tasks (fade out after shown) */}
      {activeTasks.length === 0 &&
        recentCompletedTasks.map((task) => (
          <div
            key={task.id}
            className={`px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-in slide-in-from-bottom-2 ${
              task.status === "completed"
                ? "bg-green-600 text-white"
                : "bg-red-600 text-white"
            }`}
          >
            {task.status === "completed" ? (
              <CheckCircle className="h-4 w-4 flex-shrink-0" />
            ) : (
              <XCircle className="h-4 w-4 flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{task.channelName}</div>
              <div className="text-xs opacity-80">
                {task.status === "completed"
                  ? `${task.totalVideos}개 영상 완료`
                  : "처리 실패"}
              </div>
            </div>
          </div>
        ))}
    </div>
  );
}
