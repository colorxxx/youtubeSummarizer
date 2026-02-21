import { eq, desc, and, inArray, like, sql, count } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, InsertSubscription, InsertVideo, InsertSummary, InsertUserSettings, users, subscriptions, videos, summaries, userSettings } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

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

export async function saveVideo(video: InsertVideo) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    await db.insert(videos).values(video);
  } catch (error: any) {
    const isDup = error.code === 'ER_DUP_ENTRY' || error?.cause?.code === 'ER_DUP_ENTRY';
    if (isDup) {
      console.log(`Video ${video.videoId} already exists, skipping`);
    } else {
      throw error;
    }
  }
}

export async function getRecentVideos(channelIds: string[], limit: number = 50) {
  const db = await getDb();
  if (!db || channelIds.length === 0) return [];

  return db
    .select()
    .from(videos)
    .where(inArray(videos.channelId, channelIds))
    .orderBy(desc(videos.publishedAt))
    .limit(limit);
}

export async function getVideosByIds(videoIds: string[]) {
  const db = await getDb();
  if (!db || videoIds.length === 0) return [];

  return db.select().from(videos).where(inArray(videos.videoId, videoIds));
}

export async function saveSummary(summary: InsertSummary) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(summaries).values(summary);
}

export async function getUserSummaryForVideo(userId: number, videoId: string) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(summaries)
    .where(and(eq(summaries.userId, userId), eq(summaries.videoId, videoId)))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

export async function getUserSummaries(userId: number, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(summaries).where(eq(summaries.userId, userId)).orderBy(desc(summaries.createdAt)).limit(limit);
}

export async function getUserSummariesPaginated(
  userId: number,
  page: number = 1,
  limit: number = 10,
  search?: string,
) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };

  const offset = (page - 1) * limit;

  const baseConditions = search
    ? and(eq(summaries.userId, userId), like(videos.title, `%${search}%`))
    : eq(summaries.userId, userId);

  const [countResult, items] = await Promise.all([
    db
      .select({ total: count() })
      .from(summaries)
      .leftJoin(videos, eq(summaries.videoId, videos.videoId))
      .where(baseConditions),
    db
      .select({
        id: summaries.id,
        videoId: summaries.videoId,
        userId: summaries.userId,
        summary: summaries.summary,
        detailedSummary: summaries.detailedSummary,
        createdAt: summaries.createdAt,
        videoTitle: videos.title,
        videoThumbnailUrl: videos.thumbnailUrl,
        videoPublishedAt: videos.publishedAt,
        videoDuration: videos.duration,
        videoChannelId: videos.channelId,
      })
      .from(summaries)
      .leftJoin(videos, eq(summaries.videoId, videos.videoId))
      .where(baseConditions)
      .orderBy(desc(summaries.createdAt))
      .limit(limit)
      .offset(offset),
  ]);

  return {
    items,
    total: countResult[0]?.total ?? 0,
  };
}

export async function getSummariesGroupedByChannel(userId: number) {
  const db = await getDb();
  if (!db) return [];

  const userSubs = await getUserSubscriptions(userId);
  const allSummaries = await getUserSummaries(userId, 200);

  const videoIds = allSummaries.map((s) => s.videoId);
  const allVideos = await getVideosByIds(videoIds);
  const videoMap = new Map(allVideos.map((v) => [v.videoId, v]));

  const grouped = userSubs.map((sub) => {
    const channelSummaries = allSummaries
      .filter((s) => {
        const video = videoMap.get(s.videoId);
        return video && video.channelId === sub.channelId;
      })
      .map((s) => ({
        ...s,
        video: videoMap.get(s.videoId),
      }));

    return {
      channel: sub,
      summaries: channelSummaries,
    };
  });

  return grouped;
}

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

export async function getAllUsersWithEmailEnabled() {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(userSettings).where(eq(userSettings.emailEnabled, 1));
}

export async function getAllSubscriptions() {
  const db = await getDb();
  if (!db) return [];
  
  try {
    return await db.select().from(subscriptions);
  } catch (error) {
    console.error("[Database] Error getting all subscriptions:", error);
    return [];
  }
}

export async function deleteSummary(userId: number, summaryId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(summaries).where(
    and(eq(summaries.id, summaryId), eq(summaries.userId, userId))
  );
}

export async function getVideoByVideoId(videoId: string) {
  const db = await getDb();
  if (!db) return undefined;
  
  try {
    const result = await db.select().from(videos).where(eq(videos.videoId, videoId)).limit(1);
    return result.length > 0 ? result[0] : undefined;
  } catch (error) {
    console.error("[Database] Error getting video by videoId:", error);
    return undefined;
  }
}
