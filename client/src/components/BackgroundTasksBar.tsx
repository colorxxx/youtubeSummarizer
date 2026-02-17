import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

export function BackgroundTasksBar() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const previousTasksRef = useRef<Map<string, string>>(new Map());

  const { data: tasks } = trpc.backgroundTasks.list.useQuery(undefined, {
    enabled: !!user,
    refetchInterval: 2000,
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

  // UI 제거 - 토스트 알림만 표시
  return null;
}
