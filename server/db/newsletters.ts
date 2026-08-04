import { eq, desc, and, gte, lt, inArray } from "drizzle-orm";
import { InsertNewsletter, newsletters, summaries, videos, subscriptions } from "../../drizzle/schema";
import { getDb } from "./connection";

export async function saveNewsletter(newsletter: InsertNewsletter) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Replace an existing issue for the same user/topic/week
  await db
    .delete(newsletters)
    .where(
      and(
        eq(newsletters.userId, newsletter.userId),
        eq(newsletters.topic, newsletter.topic ?? "ai-trends"),
        eq(newsletters.weekStart, newsletter.weekStart),
      ),
    );
  await db.insert(newsletters).values(newsletter);

  const [saved] = await db
    .select()
    .from(newsletters)
    .where(
      and(
        eq(newsletters.userId, newsletter.userId),
        eq(newsletters.topic, newsletter.topic ?? "ai-trends"),
        eq(newsletters.weekStart, newsletter.weekStart),
      ),
    )
    .limit(1);
  return saved;
}

export async function getUserNewsletters(userId: number, topic?: string) {
  const db = await getDb();
  if (!db) return [];

  const conditions = topic
    ? and(eq(newsletters.userId, userId), eq(newsletters.topic, topic))
    : eq(newsletters.userId, userId);

  return db
    .select({
      id: newsletters.id,
      topic: newsletters.topic,
      title: newsletters.title,
      weekStart: newsletters.weekStart,
      weekEnd: newsletters.weekEnd,
      videoCount: newsletters.videoCount,
      emailSentAt: newsletters.emailSentAt,
      createdAt: newsletters.createdAt,
    })
    .from(newsletters)
    .where(conditions)
    .orderBy(desc(newsletters.weekStart));
}

export async function getNewsletterById(userId: number, id: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(newsletters)
    .where(and(eq(newsletters.id, id), eq(newsletters.userId, userId)))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

export async function markNewsletterEmailSent(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(newsletters).set({ emailSentAt: new Date() }).where(eq(newsletters.id, id));
}

export type WeeklySummaryRow = {
  videoId: string;
  channelId: string;
  channelName: string;
  title: string;
  publishedAt: Date;
  duration: string | null;
  thumbnailUrl: string | null;
  summary: string;
  detailedSummary: string | null;
};

/**
 * Fetch a user's summaries for videos published in [weekStart, weekEnd)
 * limited to the given channels, joined with video/channel metadata.
 */
export async function getWeeklySummariesForChannels(
  userId: number,
  channelIds: string[],
  weekStart: Date,
  weekEnd: Date,
): Promise<WeeklySummaryRow[]> {
  const db = await getDb();
  if (!db || channelIds.length === 0) return [];

  const rows = await db
    .select({
      videoId: summaries.videoId,
      channelId: videos.channelId,
      channelName: subscriptions.channelName,
      title: videos.title,
      publishedAt: videos.publishedAt,
      duration: videos.duration,
      thumbnailUrl: videos.thumbnailUrl,
      summary: summaries.summary,
      detailedSummary: summaries.detailedSummary,
    })
    .from(summaries)
    .innerJoin(videos, eq(summaries.videoId, videos.videoId))
    .innerJoin(
      subscriptions,
      and(eq(subscriptions.channelId, videos.channelId), eq(subscriptions.userId, userId)),
    )
    .where(
      and(
        eq(summaries.userId, userId),
        inArray(videos.channelId, channelIds),
        gte(videos.publishedAt, weekStart),
        lt(videos.publishedAt, weekEnd),
      ),
    )
    .orderBy(desc(videos.publishedAt));

  // A video can appear twice if the user summarized it both via subscription and directly
  const seen = new Set<string>();
  return rows.filter((r) => {
    if (seen.has(r.videoId)) return false;
    seen.add(r.videoId);
    return true;
  });
}
