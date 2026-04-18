import { eq, desc, and, like, count, gte, or, sql, exists, notExists } from "drizzle-orm";
import { InsertSummary, summaries, videos, bookmarks, playlists, playlistVideos } from "../../drizzle/schema";
import { getDb } from './connection';
import { getUserSubscriptions } from './subscriptions';
import { getVideosByIds } from './videos';

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

export type SummaryFilter = "uncategorized" | "bookmarked" | "in_playlist";

export async function getUserSummariesPaginated(
  userId: number,
  page: number = 1,
  limit: number = 10,
  search?: string,
  filter?: SummaryFilter[],
) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };

  const offset = (page - 1) * limit;

  const searchCondition = search
    ? or(
        like(videos.title, `%${search}%`),
        like(summaries.summary, `%${search}%`),
        like(summaries.detailedSummary, `%${search}%`),
      )
    : undefined;

  // Build filter condition from checkbox selections (OR combination)
  let filterCondition;
  if (filter && filter.length > 0) {
    const bookmarkExistsQuery = db.select({ one: sql`1` }).from(bookmarks).where(
      and(eq(bookmarks.videoId, summaries.videoId), eq(bookmarks.userId, userId))
    );
    const playlistExistsQuery = db.select({ one: sql`1` }).from(playlistVideos)
      .innerJoin(playlists, eq(playlists.id, playlistVideos.playlistId))
      .where(
        and(eq(playlistVideos.videoId, summaries.videoId), eq(playlists.userId, userId))
      );

    const conditions = [];
    if (filter.includes("bookmarked")) conditions.push(exists(bookmarkExistsQuery));
    if (filter.includes("in_playlist")) conditions.push(exists(playlistExistsQuery));
    if (filter.includes("uncategorized")) {
      conditions.push(and(notExists(bookmarkExistsQuery), notExists(playlistExistsQuery)));
    }
    filterCondition = conditions.length === 1 ? conditions[0] : or(...conditions);
  }

  const baseConditions = and(eq(summaries.userId, userId), searchCondition, filterCondition);

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
      .orderBy(
        ...(search
          ? [
              desc(sql`CASE WHEN ${videos.title} LIKE ${'%' + search + '%'} THEN 1 ELSE 0 END`),
              desc(summaries.createdAt),
            ]
          : [desc(summaries.createdAt)])
      )
      .limit(limit)
      .offset(offset),
  ]);

  return {
    items,
    total: countResult[0]?.total ?? 0,
  };
}

export async function getDirectSummariesPaginated(
  userId: number,
  page: number = 1,
  limit: number = 10,
  search?: string,
) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };

  const offset = (page - 1) * limit;

  const searchCondition = search
    ? or(
        like(videos.title, `%${search}%`),
        like(summaries.summary, `%${search}%`),
        like(summaries.detailedSummary, `%${search}%`),
      )
    : undefined;

  const baseConditions = search
    ? and(eq(summaries.userId, userId), eq(summaries.source, "direct"), searchCondition)
    : and(eq(summaries.userId, userId), eq(summaries.source, "direct"));

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
      .orderBy(
        ...(search
          ? [
              desc(sql`CASE WHEN ${videos.title} LIKE ${'%' + search + '%'} THEN 1 ELSE 0 END`),
              desc(summaries.createdAt),
            ]
          : [desc(summaries.createdAt)])
      )
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
  const allSummaries = await getUserSummaries(userId, 4000);

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

export async function deleteSummary(userId: number, summaryId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // 1. 삭제 대상 summary의 videoId 조회
  const target = await db.select({ videoId: summaries.videoId })
    .from(summaries)
    .where(and(eq(summaries.id, summaryId), eq(summaries.userId, userId)))
    .limit(1);

  // 2. summary 삭제
  await db.delete(summaries).where(
    and(eq(summaries.id, summaryId), eq(summaries.userId, userId))
  );

  // 자막 캐시는 유지 — 삭제 후 재요약 시 기존 자막을 재활용
  // (이전에 null로 초기화하면 yt-dlp 재fetch 실패 시 description fallback으로 품질 저하)
}

export async function getMonthlyUserSummaryCount(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const result = await db
    .select({ total: count() })
    .from(summaries)
    .where(and(
      eq(summaries.userId, userId),
      gte(summaries.createdAt, startOfMonth),
    ));

  return result[0]?.total ?? 0;
}
