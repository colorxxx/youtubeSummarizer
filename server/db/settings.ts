import { eq } from "drizzle-orm";
import { InsertUserSettings, userSettings } from "../../drizzle/schema";
import { getDb } from './connection';

export async function getUserSettings(userId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1);

  return result.length > 0 ? result[0] : null;
}

export async function upsertUserSettings(settings: InsertUserSettings) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await getUserSettings(settings.userId);

  if (existing) {
    await db.update(userSettings).set(settings).where(eq(userSettings.userId, settings.userId));
  } else {
    await db.insert(userSettings).values(settings);
  }
}
