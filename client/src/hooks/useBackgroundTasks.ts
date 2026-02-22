import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useEffect, useRef } from "react";

export function useBackgroundTasks(onTaskCompleted?: () => void) {
  const { user } = useAuth();
  const prevTasksRef = useRef<Map<string, string>>(new Map());

  const { data: tasks } = trpc.backgroundTasks.list.useQuery(undefined, {
    enabled: !!user,
    refetchInterval: 2000,
  });

  useEffect(() => {
    if (!tasks) return;

    const prevTasks = prevTasksRef.current;

    for (const task of tasks) {
      const prevStatus = prevTasks.get(task.id);
      if (prevStatus === "processing" && task.status === "completed") {
        onTaskCompleted?.();
        break;
      }
    }

    const newMap = new Map<string, string>();
    for (const task of tasks) {
      newMap.set(task.id, task.status);
    }
    prevTasksRef.current = newMap;
  }, [tasks, onTaskCompleted]);

  // channelId로 해당 채널의 진행 중인 작업 찾기
  const getTaskForChannel = (channelId: string) => {
    return tasks?.find((t) => t.channelId === channelId && t.status === "processing");
  };

  return { tasks, getTaskForChannel };
}
