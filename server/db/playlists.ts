import { eq, desc, and, count } from "drizzle-orm";
import { playlists, playlistVideos, summaries, videos } from "../../drizzle/schema";
import { createLogger } from '../_core/logger';
import { getDb } from './connection';

const log = createLogger("Database");

export async function createPlaylist(userId: number, name: string, description?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(playlists).values({ userId, name, description: description ?? null });
  const insertId = (result[0] as any).insertId as number;
  const rows = await db.select().from(playlists).where(eq(playlists.id, insertId)).limit(1);
  return rows[0];
}

export async function getUserPlaylists(userId: number) {
  const db = await getDb();
  if (!db) return [];

  const rows = await db
    .select()
    .from(playlists)
    .where(eq(playlists.userId, userId))
    .orderBy(desc(playlists.updatedAt));

  const withCounts = await Promise.all(
    rows.map(async (playlist) => {
      const countResult = await db!
        .select({ total: count() })
        .from(playlistVideos)
        .where(eq(playlistVideos.playlistId, playlist.id));
      return { ...playlist, videoCount: countResult[0]?.total ?? 0 };
    })
  );

  return withCounts;
}

export async function updatePlaylist(userId: number, playlistId: number, name: string, description?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(playlists)
    .set({ name, description: description ?? null })
    .where(and(eq(playlists.id, playlistId), eq(playlists.userId, userId)));
}

export async function deletePlaylist(userId: number, playlistId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(playlistVideos).where(eq(playlistVideos.playlistId, playlistId));
  await db.delete(playlists).where(and(eq(playlists.id, playlistId), eq(playlists.userId, userId)));
}

export async function addVideoToPlaylist(playlistId: number, videoId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    await db.insert(playlistVideos).values({ playlistId, videoId });
  } catch (error: any) {
    const isDup = error.code === 'ER_DUP_ENTRY' || error?.cause?.code === 'ER_DUP_ENTRY';
    if (isDup) {
      log.info(`Video ${videoId} already in playlist ${playlistId}, skipping`);
    } else {
      throw error;
    }
  }
}

export async function removeVideoFromPlaylist(playlistId: number, videoId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(playlistVideos).where(
    and(eq(playlistVideos.playlistId, playlistId), eq(playlistVideos.videoId, videoId))
  );
}

export async function getPlaylistVideos(userId: number, playlistId: number, page: number, limit: number) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };

  // Verify ownership
  const playlist = await db.select().from(playlists).where(
    and(eq(playlists.id, playlistId), eq(playlists.userId, userId))
  ).limit(1);

  if (playlist.length === 0) return { items: [], total: 0 };

  const offset = (page - 1) * limit;

  const baseCondition = and(
    eq(playlistVideos.playlistId, playlistId),
    eq(summaries.userId, userId)
  );

  const [countResult, items] = await Promise.all([
    db
      .select({ total: count() })
      .from(playlistVideos)
      .innerJoin(summaries, and(eq(playlistVideos.videoId, summaries.videoId), eq(summaries.userId, userId)))
      .leftJoin(videos, eq(summaries.videoId, videos.videoId))
      .where(baseCondition),
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
        addedAt: playlistVideos.addedAt,
      })
      .from(playlistVideos)
      .innerJoin(summaries, and(eq(playlistVideos.videoId, summaries.videoId), eq(summaries.userId, userId)))
      .leftJoin(videos, eq(summaries.videoId, videos.videoId))
      .where(baseCondition)
      .orderBy(desc(playlistVideos.addedAt))
      .limit(limit)
      .offset(offset),
  ]);

  return {
    items,
    total: countResult[0]?.total ?? 0,
  };
}

export async function getPlaylistsForVideo(userId: number, videoId: string): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];

  const rows = await db
    .select({ playlistId: playlistVideos.playlistId })
    .from(playlists)
    .innerJoin(playlistVideos, eq(playlists.id, playlistVideos.playlistId))
    .where(and(eq(playlists.userId, userId), eq(playlistVideos.videoId, videoId)));

  return rows.map((r) => r.playlistId);
}
