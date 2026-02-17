import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

export function useBackgroundTasks() {
  const { user } = useAuth();

  const { data: tasks } = trpc.backgroundTasks.list.useQuery(undefined, {
    enabled: !!user,
    refetchInterval: 2000,
  });

  // channelId로 해당 채널의 진행 중인 작업 찾기
  const getTaskForChannel = (channelId: string) => {
    return tasks?.find((t) => t.channelId === channelId && t.status === "processing");
  };

  return { tasks, getTaskForChannel };
}
