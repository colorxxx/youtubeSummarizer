/**
 * Backfill transcripts (and regenerate summaries) for videos whose transcript
 * fetch failed — e.g. the 2026-08-04~13 outage where yt-dlp's EJS challenge
 * solver was broken by an unsupported Node runtime in production.
 *
 * Runs locally: yt-dlp fetches with the local network/cookies, results are
 * written to the DATABASE_URL database (production if .env points there).
 *
 * Usage: pnpm tsx scripts/backfill-transcripts.ts [sinceISO] [--dry-run] [--skip-summaries]
 *   sinceISO - only videos published on/after this date (default 2026-08-01)
 */
import "dotenv/config";
import { and, eq, gte, isNull, or } from "drizzle-orm";
import { summaries, videos } from "../drizzle/schema";
import { getDb } from "../server/db/connection";
import { generateVideoSummary } from "../server/summarizer";
import { getVideoTranscript, initYtCookies } from "../server/youtube";

const args = process.argv.slice(2);
const sinceArg = args.find((a) => !a.startsWith("--"));
const since = new Date(sinceArg ?? "2026-08-01T00:00:00Z");
const dryRun = args.includes("--dry-run");
const skipSummaries = args.includes("--skip-summaries");

(async () => {
  await initYtCookies(); // /tmp/yt-cookies.txt from YT_COOKIES_BASE64 — 없으면 429 잘 걸림
  const db = await getDb();
  if (!db) throw new Error("Database not available — check DATABASE_URL");

  const targets = await db
    .select({
      videoId: videos.videoId,
      title: videos.title,
      description: videos.description,
      duration: videos.duration,
      publishedAt: videos.publishedAt,
    })
    .from(videos)
    .where(and(gte(videos.publishedAt, since), or(isNull(videos.transcript), eq(videos.transcript, ""))))
    .orderBy(videos.publishedAt);

  console.log(`${targets.length} videos missing transcripts since ${since.toISOString().slice(0, 10)}\n`);
  if (dryRun) {
    for (const v of targets) console.log(`  ${v.videoId} ${v.publishedAt.toISOString().slice(0, 10)} ${v.title.slice(0, 50)}`);
    process.exit(0);
  }

  let ok = 0;
  let fail = 0;

  for (const [i, video] of targets.entries()) {
    const label = `[${i + 1}/${targets.length}] ${video.videoId}`;
    try {
      const transcript = await getVideoTranscript(video.videoId);
      if (!transcript.available) {
        fail++;
        console.log(`${label} ✗ transcript unavailable — ${video.title.slice(0, 50)}`);
        continue;
      }

      await db.update(videos).set({ transcript: transcript.text }).where(eq(videos.videoId, video.videoId));
      ok++;
      console.log(`${label} ✓ ${transcript.text.length} chars — ${video.title.slice(0, 50)}`);

      if (skipSummaries) continue;

      // Regenerate summaries for every user that has one for this video
      // (generateVideoSummary reads the now-cached transcript from DB)
      const rows = await db
        .select({ id: summaries.id, userId: summaries.userId })
        .from(summaries)
        .where(eq(summaries.videoId, video.videoId));

      if (rows.length === 0) continue;

      const result = await generateVideoSummary(
        video.videoId,
        video.title,
        video.description ?? "",
        video.duration ?? undefined,
      );
      for (const row of rows) {
        await db
          .update(summaries)
          .set({ summary: result.brief, detailedSummary: result.detailed })
          .where(eq(summaries.id, row.id));
      }
      console.log(`${label}   summaries regenerated for ${rows.length} row(s)`);
    } catch (error) {
      fail++;
      console.log(`${label} ✗ error: ${error instanceof Error ? error.message.split("\n")[0] : error}`);
    }
  }

  console.log(`\nDone: ${ok} transcripts filled, ${fail} failed, ${targets.length} total`);
  process.exit(0);
})();
