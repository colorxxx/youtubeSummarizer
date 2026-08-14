/** 과거 LLM 에러로 "Failed to generate..."가 저장된 요약 41건 재생성 (자막은 DB에 있음) */
import "dotenv/config";
import { and, eq, like } from "drizzle-orm";
import { summaries, videos } from "../drizzle/schema";
import { getDb } from "../server/db/connection";
import { generateVideoSummary } from "../server/summarizer";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const db = await getDb();
  if (!db) throw new Error("no db");

  const rows = await db
    .select({
      id: summaries.id,
      videoId: summaries.videoId,
      title: videos.title,
      description: videos.description,
      duration: videos.duration,
    })
    .from(summaries)
    .innerJoin(videos, eq(videos.videoId, summaries.videoId))
    .where(like(summaries.summary, "Failed to generate%"));

  console.log(`${rows.length} failed summaries to repair`);
  let ok = 0;
  let fail = 0;

  for (const [i, row] of rows.entries()) {
    const isFailure = (r: { brief: string }) =>
      r.brief.startsWith("Failed to generate") || r.brief.startsWith("No content available");
    try {
      let result = await generateVideoSummary(row.videoId, row.title, row.description ?? "", row.duration ?? undefined, "qwen");
      if (isFailure(result)) {
        console.log(`[${i + 1}/${rows.length}] ${row.videoId} qwen failed, retrying deepseek`);
        result = await generateVideoSummary(row.videoId, row.title, row.description ?? "", row.duration ?? undefined, "deepseek");
      }
      if (isFailure(result)) {
        fail++;
        console.log(`[${i + 1}/${rows.length}] ${row.videoId} ✗ both providers failed`);
      } else {
        await db.update(summaries).set({ summary: result.brief, detailedSummary: result.detailed }).where(eq(summaries.id, row.id));
        ok++;
        console.log(`[${i + 1}/${rows.length}] ${row.videoId} ✓ ${row.title.slice(0, 40)}`);
      }
    } catch (e) {
      fail++;
      console.log(`[${i + 1}/${rows.length}] ${row.videoId} ✗ ${e instanceof Error ? e.message.split("\n")[0] : e}`);
    }
    await sleep(3000);
  }

  console.log(`\nDone: ${ok} repaired, ${fail} failed`);
  process.exit(0);
})();
