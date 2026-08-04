/**
 * Backfill weekly AI trends newsletters for past weeks.
 *
 * Usage: pnpm tsx scripts/backfill-newsletters.ts [weeks] [userId]
 *   weeks  - how many completed weeks to backfill (default 9 ≈ 2 months)
 *   userId - target user (default 1)
 */
import "dotenv/config";
import { generateWeeklyNewsletter, getWeekStartKst } from "../server/newsletter";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const weeks = Number(process.argv[2] ?? "9");
const userId = Number(process.argv[3] ?? "1");
const userEmail = process.env.PREMIUM_EMAIL ?? null;

(async () => {
  console.log(`Backfilling ${weeks} weeks of newsletters for user ${userId}...\n`);

  // Oldest first; skip the current (incomplete) week
  for (let i = weeks; i >= 1; i--) {
    const date = new Date(Date.now() - i * WEEK_MS);
    const weekStart = getWeekStartKst(date);
    const label = weekStart.toISOString().slice(0, 10);

    try {
      const result = await generateWeeklyNewsletter(userId, userEmail, date);
      if (result.status === "empty") {
        console.log(`[${label}] skipped — no AI channel summaries that week`);
      } else {
        console.log(
          `[${label}] generated #${result.newsletter.id}: "${result.newsletter.title}" (${result.newsletter.videoCount} videos)`,
        );
      }
    } catch (error) {
      console.error(`[${label}] FAILED:`, error instanceof Error ? error.message : error);
    }
  }

  console.log("\nBackfill complete.");
  process.exit(0);
})();
