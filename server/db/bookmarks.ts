import { eq, desc, and, like, count } from "drizzle-orm";
import { bookmarks, summaries, videos } from "../../drizzle/schema";
import { getDb } from './connection';

export async function toggleBookmark(userId: number, videoId: string): Promise<{ bookmarked: boolean }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await db
    .select()
    .from(bookmarks)
    .where(and(eq(bookmarks.userId, userId), eq(bookmarks.videoId, videoId)))
    .limit(1);

  if (existing.length > 0) {
    await db.delete(bookmarks).where(
      and(eq(bookmarks.userId, userId), eq(bookmarks.videoId, videoId))
    );
    return { bookmarked: false };
  } else {
    await db.insert(bookmarks).values({ userId, videoId });
    return { bookmarked: true };
  }
}

export async function getUserBookmarks(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(bookmarks)
    .where(eq(bookmarks.userId, userId))
    .orderBy(desc(bookmarks.createdAt));
}

export async function getUserBookmarkedSummaries(
  userId: number,
  page: number = 1,
  limit: number = 10,
  search?: string,
) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };

  const offset = (page - 1) * limit;

  const baseConditions = search
    ? and(eq(bookmarks.userId, userId), like(videos.title, `%${search}%`))
    : eq(bookmarks.userId, userId);

  const [countResult, items] = await Promise.all([
    db
      .select({ total: count() })
      .from(summaries)
      .innerJoin(bookmarks, and(eq(summaries.videoId, bookmarks.videoId), eq(bookmarks.userId, userId)))
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
      .innerJoin(bookmarks, and(eq(summaries.videoId, bookmarks.videoId), eq(bookmarks.userId, userId)))
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
