/**
 * Backfill transcripts (and regenerate summaries) for videos whose transcript
 * fetch failed — e.g. the 2026-08-04~13 outage where yt-dlp's EJS challenge
 * solver was broken by an unsupported Node runtime in production.
 *
 * Runs locally: yt-dlp fetches with the local network/cookies, results are
 * written to the DATABASE_URL database (production if .env points there).
 * Safe to re-run: only videos still missing transcripts are targeted.
 *
 * Usage: pnpm tsx scripts/backfill-transcripts.ts [sinceISO] [options]
 *   sinceISO          only videos published on/after this date (default 2026-08-01)
 *   --dry-run         list targets and exit
 *   --skip-summaries  fill transcripts only, don't regenerate summaries
 *   --delay=N         base seconds to wait between videos (default 10, ±50% jitter)
 *   --batch-pause=N   extra seconds to pause every 25 videos (default 120)
 */
import "dotenv/config";
import { and, desc, eq, gte, isNull, or } from "drizzle-orm";
import { summaries, videos } from "../drizzle/schema";
import { getDb } from "../server/db/connection";
import { generateVideoSummary } from "../server/summarizer";
import { getVideoTranscript, initYtCookies } from "../server/youtube";

const args = process.argv.slice(2);
const sinceArg = args.find((a) => !a.startsWith("--"));
const since = new Date(sinceArg ?? "2026-08-01T00:00:00Z");
const dryRun = args.includes("--dry-run");
const skipSummaries = args.includes("--skip-summaries");
const numOpt = (name: string, def: number) => {
  const raw = args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : def;
};
const baseDelaySec = numOpt("delay", 10);
const batchPauseSec = numOpt("batch-pause", 120);
const BATCH_SIZE = 25;
// 연속 실패가 이 횟수에 달하면 rate limit으로 간주하고 장기 휴식
const CONSECUTIVE_FAIL_BACKOFF_AT = 5;
const BACKOFF_MINUTES = 15;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
    .orderBy(desc(videos.publishedAt)); // 최신 영상부터 복구

  console.log(
    `${targets.length} videos missing transcripts since ${since.toISOString().slice(0, 10)} ` +
    `(delay ${baseDelaySec}s ±50%, pause ${batchPauseSec}s per ${BATCH_SIZE})\n`,
  );
  if (dryRun) {
    for (const v of targets) console.log(`  ${v.videoId} ${v.publishedAt.toISOString().slice(0, 10)} ${v.title.slice(0, 50)}`);
    process.exit(0);
  }

  let ok = 0;
  let fail = 0;
  let consecutiveFails = 0;

  for (const [i, video] of targets.entries()) {
    const label = `[${i + 1}/${targets.length}] ${video.videoId}`;
    try {
      const transcript = await getVideoTranscript(video.videoId);
      if (!transcript.available) {
        fail++;
        consecutiveFails++;
        console.log(`${label} ✗ transcript unavailable — ${video.title.slice(0, 50)}`);
      } else {
        consecutiveFails = 0;
        await db.update(videos).set({ transcript: transcript.text }).where(eq(videos.videoId, video.videoId));
        ok++;
        console.log(`${label} ✓ ${transcript.text.length} chars — ${video.title.slice(0, 50)}`);

        if (!skipSummaries) {
          // Regenerate summaries for every user that has one for this video
          // (generateVideoSummary reads the now-cached transcript from DB)
          const rows = await db
            .select({ id: summaries.id, userId: summaries.userId })
            .from(summaries)
            .where(eq(summaries.videoId, video.videoId));

          if (rows.length > 0) {
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
          }
        }
      }
    } catch (error) {
      fail++;
      consecutiveFails++;
      console.log(`${label} ✗ error: ${error instanceof Error ? error.message.split("\n")[0] : error}`);
    }

    if (i === targets.length - 1) break;

    if (consecutiveFails >= CONSECUTIVE_FAIL_BACKOFF_AT) {
      console.log(`-- ${consecutiveFails} consecutive failures, backing off ${BACKOFF_MINUTES}min --`);
      await sleep(BACKOFF_MINUTES * 60 * 1000);
      consecutiveFails = 0;
    } else if ((i + 1) % BATCH_SIZE === 0) {
      console.log(`-- batch pause ${batchPauseSec}s (${i + 1}/${targets.length}, ok ${ok} / fail ${fail}) --`);
      await sleep(batchPauseSec * 1000);
    } else {
      const jitter = baseDelaySec * (0.5 + Math.random()); // 0.5x ~ 1.5x
      await sleep(jitter * 1000);
    }
  }

  console.log(`\nDone: ${ok} transcripts filled, ${fail} failed, ${targets.length} total`);
  process.exit(0);
})();
