import { eq, desc, and } from "drizzle-orm";
import { InsertSubscription, subscriptions } from "../../drizzle/schema";
import { createLogger } from '../_core/logger';
import { getDb } from './connection';

const log = createLogger("Database");

export async function addSubscription(subscription: InsertSubscription) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(subscriptions).values(subscription);
}

export async function getUserSubscriptions(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).orderBy(desc(subscriptions.addedAt));
}

export async function removeSubscription(userId: number, channelId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(subscriptions).where(
    and(eq(subscriptions.userId, userId), eq(subscriptions.channelId, channelId))
  );
}

export async function getSubscription(userId: number, channelId: string) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.userId, userId), eq(subscriptions.channelId, channelId)))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

export async function isChannelSubscribed(userId: number, channelId: string): Promise<boolean> {
  const sub = await getSubscription(userId, channelId);
  return sub !== null;
}

export async function updateSubscriptionSettings(userId: number, channelId: string, videoCount: number | null) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(subscriptions)
    .set({ videoCount })
    .where(and(eq(subscriptions.userId, userId), eq(subscriptions.channelId, channelId)));
}

export async function getAllSubscriptions() {
  const db = await getDb();
  if (!db) return [];

  try {
    return await db.select().from(subscriptions);
  } catch (error) {
    log.error("Error getting all subscriptions:", error);
    return [];
  }
}
