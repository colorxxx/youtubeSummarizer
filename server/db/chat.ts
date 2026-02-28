import { eq, and } from "drizzle-orm";
import { chatMessages } from "../../drizzle/schema";
import { getDb } from './connection';

export async function getChatHistory(userId: number, videoId: string) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(chatMessages)
    .where(and(eq(chatMessages.userId, userId), eq(chatMessages.videoId, videoId)))
    .orderBy(chatMessages.createdAt);
}

export async function deleteChatHistory(userId: number, videoId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(chatMessages).where(
    and(eq(chatMessages.userId, userId), eq(chatMessages.videoId, videoId))
  );
}

export async function saveChatMessage(userId: number, videoId: string, role: "user" | "assistant", content: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(chatMessages).values({ userId, videoId, role, content });
}
