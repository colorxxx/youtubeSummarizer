import { eq, desc, inArray } from "drizzle-orm";
import { InsertVideo, videos } from "../../drizzle/schema";
import { createLogger } from '../_core/logger';
import { getDb } from './connection';

const log = createLogger("Database");

export async function saveVideo(video: InsertVideo) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    await db.insert(videos).values(video);
  } catch (error: any) {
    const isDup = error.code === 'ER_DUP_ENTRY' || error?.cause?.code === 'ER_DUP_ENTRY';
    if (isDup) {
      log.info(`Video ${video.videoId} already exists, skipping`);
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

  return db.select({
    id: videos.id,
    videoId: videos.videoId,
    channelId: videos.channelId,
    title: videos.title,
    description: videos.description,
    publishedAt: videos.publishedAt,
    thumbnailUrl: videos.thumbnailUrl,
    duration: videos.duration,
  }).from(videos).where(inArray(videos.videoId, videoIds));
}

export async function getVideoByVideoId(videoId: string) {
  const db = await getDb();
  if (!db) return undefined;

  try {
    const result = await db.select().from(videos).where(eq(videos.videoId, videoId)).limit(1);
    return result.length > 0 ? result[0] : undefined;
  } catch (error) {
    log.error("Error getting video by videoId:", error);
    return undefined;
  }
}

export async function getOrFetchTranscript(videoId: string): Promise<{ text: string; available: boolean }> {
  const { getVideoTranscript } = await import("../youtube");

  const db = await getDb();
  if (!db) {
    // DB 사용 불가 시 직접 fetch
    return getVideoTranscript(videoId);
  }

  // DB에서 캐시 확인
  const result = await db.select({ transcript: videos.transcript }).from(videos).where(eq(videos.videoId, videoId)).limit(1);
  const row = result[0];

  if (row && row.transcript !== null) {
    // 캐시 히트: 실제 자막이 있으면 반환, 빈 문자열은 이전 실패 → 재시도
    if (row.transcript.length > 0) {
      return { text: row.transcript, available: true };
    }
    // 빈 문자열 = 이전 youtube-transcript 실패 캐시 → fall through하여 재시도
  }

  // 캐시 미스 또는 빈 문자열 → YouTube에서 fetch
  const fetched = await getVideoTranscript(videoId);
  const textToStore = fetched.available ? fetched.text : null;

  try {
    await db.update(videos).set({ transcript: textToStore }).where(eq(videos.videoId, videoId));
    log.info(`Cached transcript for ${videoId} (${textToStore?.length ?? 0} chars)`);
  } catch (error) {
    log.error(`Failed to cache transcript for ${videoId}:`, error);
  }

  return fetched;
}
