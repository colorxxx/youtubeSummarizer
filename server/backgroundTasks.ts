import { nanoid } from "nanoid";

export interface BackgroundTask {
  id: string;
  userId: number;
  channelId: string;
  channelName: string;
  status: "processing" | "completed" | "failed";
  totalVideos: number;
  processedVideos: number;
  startedAt: Date;
  completedAt?: Date;
  error?: string;
}

// In-memory task storage
const tasks = new Map<string, BackgroundTask>();

// Cleanup interval - remove completed tasks older than 1 hour
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
const TASK_TTL = 60 * 60 * 1000; // 1 hour

export function createTask(
  userId: number,
  channelId: string,
  channelName: string,
  totalVideos: number
): string {
  const id = nanoid(10);
  const task: BackgroundTask = {
    id,
    userId,
    channelId,
    channelName,
    status: "processing",
    totalVideos,
    processedVideos: 0,
    startedAt: new Date(),
  };
  tasks.set(id, task);
  return id;
}

export function updateTaskProgress(taskId: string, processedVideos: number): void {
  const task = tasks.get(taskId);
  if (task) {
    task.processedVideos = processedVideos;
  }
}

export function completeTask(taskId: string): void {
  const task = tasks.get(taskId);
  if (task) {
    task.status = "completed";
    task.completedAt = new Date();
  }
}

export function failTask(taskId: string, error: string): void {
  const task = tasks.get(taskId);
  if (task) {
    task.status = "failed";
    task.completedAt = new Date();
    task.error = error;
  }
}

export function getUserTasks(userId: number): BackgroundTask[] {
  const userTasks: BackgroundTask[] = [];
  Array.from(tasks.values()).forEach((task) => {
    if (task.userId === userId) {
      userTasks.push(task);
    }
  });
  // Sort by startedAt desc
  return userTasks.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
}

export function getActiveTasks(userId: number): BackgroundTask[] {
  return getUserTasks(userId).filter((t) => t.status === "processing");
}

export function getRecentTasks(userId: number, limit: number = 10): BackgroundTask[] {
  return getUserTasks(userId).slice(0, limit);
}

function cleanupOldTasks(): void {
  const now = Date.now();
  Array.from(tasks.entries()).forEach(([id, task]) => {
    if (task.completedAt && now - task.completedAt.getTime() > TASK_TTL) {
      tasks.delete(id);
    }
  });
}

// Start cleanup interval
setInterval(cleanupOldTasks, CLEANUP_INTERVAL);
