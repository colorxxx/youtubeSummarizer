import { invokeLLM, selectProviderForUser, type LLMProvider } from "./_core/llm";
import { createLogger } from "./_core/logger";
import {
  saveNewsletter,
  getWeeklySummariesForChannels,
  type WeeklySummaryRow,
} from "./db";
import type { Newsletter } from "../drizzle/schema";

const log = createLogger("Newsletter");

export const NEWSLETTER_TOPIC = "ai-trends";

/**
 * Channels included in the AI trends newsletter.
 * Edit this list to change coverage.
 */
export const AI_TREND_CHANNELS: Record<string, string> = {
  UCbY9xX3_jW5c2fjlZVBI4cg: "TheAIGRID",
  UCawZsQWqfGSbCI5yjkdVkTA: "Matthew Berman",
  UCMwVTLZIRRUyyVrkjDpn4pA: "Cole Medin",
  UC55ODQSvARtgSyc8ThfiepQ: "Sam Witteveen",
  UCrXSVX9a1mj8l0CMLwKgMVw: "AI Jason",
  UCNJ1Ymd5yFuUPtn21xtRbbw: "AI Explained",
  "UCz-BiVywYdO6iXhjXkw_Kgw": "AI Frontier Korea (노정석)",
  UCn8ujwUInbJkBhffxqAPBVQ: "Dave Ebbelaar",
  UCXl4i9dYBrFOabk0xGmbkRA: "Dwarkesh Patel",
  UCrDwWp7EBBv4NwvScIpBDOA: "Anthropic",
  UCXUPKJO5MZQN11PqgIvyuvQ: "Andrej Karpathy",
  UCSHZKyawb77ixDdsGog4iWA: "Lex Fridman",
};

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Monday 00:00 KST of the week containing the given date (returned as UTC Date). */
export function getWeekStartKst(date: Date): Date {
  const kst = new Date(date.getTime() + KST_OFFSET_MS);
  const day = kst.getUTCDay(); // 0=Sun
  const diffDays = (day + 6) % 7; // days since Monday
  const mondayKstMidnight = Date.UTC(
    kst.getUTCFullYear(),
    kst.getUTCMonth(),
    kst.getUTCDate() - diffDays,
  );
  return new Date(mondayKstMidnight - KST_OFFSET_MS);
}

function formatKstDate(date: Date): string {
  const kst = new Date(date.getTime() + KST_OFFSET_MS);
  return `${kst.getUTCMonth() + 1}월 ${kst.getUTCDate()}일`;
}

function formatKstShort(date: Date): string {
  const kst = new Date(date.getTime() + KST_OFFSET_MS);
  return `${kst.getUTCMonth() + 1}/${kst.getUTCDate()}`;
}

type Editorial = {
  title: string;
  tldr: string[];
  trends: Array<{ heading: string; body: string }>;
};

async function generateEditorial(
  rows: WeeklySummaryRow[],
  weekStart: Date,
  weekEnd: Date,
  provider: LLMProvider,
): Promise<Editorial> {
  const videoLines = rows
    .map((r) => {
      const detail = (r.detailedSummary ?? r.summary).slice(0, 1500);
      return `[${r.channelName}] ${r.title} (${formatKstShort(r.publishedAt)})\n${detail}`;
    })
    .join("\n\n---\n\n");

  const result = await invokeLLM(
    {
      messages: [
        {
          role: "system",
          content: [
            "당신은 AI 업계 동향을 다루는 주간 뉴스레터의 편집장입니다.",
            "구독 중인 AI 유튜브 채널들의 한 주간 영상 요약본을 받아, 그 주의 AI 동향을 종합 분석합니다.",
            "영상 요약에 실제로 언급된 내용만 사용하고, 추측이나 외부 지식으로 사실을 지어내지 마세요.",
            "출력은 반드시 한국어로 작성합니다.",
          ].join(" "),
        },
        {
          role: "user",
          content: [
            `기간: ${formatKstDate(weekStart)} ~ ${formatKstDate(new Date(weekEnd.getTime() - 1))}`,
            `영상 ${rows.length}개의 요약본:`,
            "",
            videoLines,
            "",
            "위 내용을 바탕으로 아래 형식의 JSON 객체만 출력하세요:",
            '{ "title": "이번 주의 가장 중요한 흐름을 담은 뉴스레터 제목 (한 줄, 이모지 없이)",',
            '  "tldr": ["이번 주 핵심 요점 4~6개, 각 한 문장"],',
            '  "trends": [{ "heading": "짧은 트렌드 제목", "body": "3~5문장의 분석. 어떤 채널/영상에서 다뤘는지 자연스럽게 언급." }] }',
            "trends는 여러 채널에 걸쳐 나타난 주요 트렌드 2~4개를 담습니다.",
          ].join("\n"),
        },
      ],
      maxTokens: 4096,
      responseFormat: { type: "json_object" },
    },
    provider,
  );

  const content = result.choices[0]?.message?.content;
  let text = typeof content === "string" ? content : JSON.stringify(content);
  // Strip markdown code fences if the model wrapped its JSON
  text = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");

  const parsed = JSON.parse(text) as Editorial;
  if (!parsed.title || !Array.isArray(parsed.tldr) || !Array.isArray(parsed.trends)) {
    throw new Error("LLM returned malformed editorial JSON");
  }
  return parsed;
}

function renderMarkdown(
  editorial: Editorial,
  rows: WeeklySummaryRow[],
  weekStart: Date,
  weekEnd: Date,
): string {
  const byChannel = new Map<string, WeeklySummaryRow[]>();
  for (const row of rows) {
    if (!byChannel.has(row.channelId)) byChannel.set(row.channelId, []);
    byChannel.get(row.channelId)!.push(row);
  }

  const channelSections = Array.from(byChannel.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .map(([channelId, channelRows]) => {
      const name = channelRows[0].channelName || AI_TREND_CHANNELS[channelId] || channelId;
      const items = channelRows
        .map(
          (r) =>
            `- **[${r.title}](https://www.youtube.com/watch?v=${r.videoId})** (${formatKstShort(r.publishedAt)})\n  ${r.summary.replace(/\n+/g, " ").trim()}`,
        )
        .join("\n");
      return `### ${name} · ${channelRows.length}개\n\n${items}`;
    })
    .join("\n\n");

  const periodLabel = `${formatKstDate(weekStart)} ~ ${formatKstDate(new Date(weekEnd.getTime() - 1))}`;

  return [
    `**AI 동향 위클리 · ${periodLabel} · 영상 ${rows.length}개**`,
    "",
    "## 이번 주 한눈에",
    "",
    editorial.tldr.map((t) => `- ${t}`).join("\n"),
    "",
    "## 주요 트렌드",
    "",
    editorial.trends.map((t) => `### ${t.heading}\n\n${t.body}`).join("\n\n"),
    "",
    "## 채널별 하이라이트",
    "",
    channelSections,
  ].join("\n");
}

export type GenerateResult =
  | { status: "generated"; newsletter: Newsletter }
  | { status: "empty"; weekStart: Date };

/**
 * Generate (or regenerate) the AI trends newsletter for the week containing `date`.
 */
export async function generateWeeklyNewsletter(
  userId: number,
  userEmail: string | null,
  date: Date,
): Promise<GenerateResult> {
  const weekStart = getWeekStartKst(date);
  const weekEnd = new Date(weekStart.getTime() + WEEK_MS);

  const channelIds = Object.keys(AI_TREND_CHANNELS);
  const rows = await getWeeklySummariesForChannels(userId, channelIds, weekStart, weekEnd);

  if (rows.length === 0) {
    log.info(`No summaries for week of ${weekStart.toISOString()}, skipping`);
    return { status: "empty", weekStart };
  }

  const provider = await selectProviderForUser(userId, userEmail);
  log.info(
    `Generating newsletter for week of ${weekStart.toISOString()} (${rows.length} videos, provider: ${provider})`,
  );

  const editorial = await generateEditorial(rows, weekStart, weekEnd, provider);
  const content = renderMarkdown(editorial, rows, weekStart, weekEnd);

  const saved = await saveNewsletter({
    userId,
    topic: NEWSLETTER_TOPIC,
    title: editorial.title,
    weekStart,
    weekEnd,
    content,
    videoCount: rows.length,
  });

  log.info(`Newsletter saved: "${editorial.title}" (id: ${saved?.id})`);
  return { status: "generated", newsletter: saved! };
}

/** Minimal markdown → email HTML converter (headings, bold, links, lists). */
export function markdownToEmailHtml(markdown: string, title: string): string {
  const escapeHtml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const inline = (s: string) =>
    escapeHtml(s)
      .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" style="color:#2563eb;text-decoration:none;">$1</a>')
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

  const lines = markdown.split("\n");
  const out: string[] = [];
  let inList = false;
  let pendingListItem: string | null = null;

  const flushListItem = () => {
    if (pendingListItem !== null) {
      out.push(`<li style="margin:6px 0;">${pendingListItem}</li>`);
      pendingListItem = null;
    }
  };
  const closeList = () => {
    flushListItem();
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
  };

  for (const line of lines) {
    if (line.startsWith("### ")) {
      closeList();
      out.push(`<h3 style="margin:20px 0 8px;font-size:16px;">${inline(line.slice(4))}</h3>`);
    } else if (line.startsWith("## ")) {
      closeList();
      out.push(
        `<h2 style="margin:28px 0 10px;font-size:19px;border-bottom:1px solid #e5e7eb;padding-bottom:6px;">${inline(line.slice(3))}</h2>`,
      );
    } else if (line.startsWith("- ")) {
      if (!inList) {
        out.push('<ul style="padding-left:20px;margin:8px 0;">');
        inList = true;
      }
      flushListItem();
      pendingListItem = inline(line.slice(2));
    } else if (/^\s{2,}\S/.test(line) && pendingListItem !== null) {
      // list item continuation line
      pendingListItem += `<br/><span style="color:#4b5563;">${inline(line.trim())}</span>`;
    } else if (line.trim() === "") {
      closeList();
    } else {
      closeList();
      out.push(`<p style="margin:8px 0;line-height:1.6;">${inline(line)}</p>`);
    }
  }
  closeList();

  return [
    '<div style="max-width:640px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Apple SD Gothic Neo,sans-serif;color:#111827;padding:24px 16px;">',
    `<h1 style="font-size:22px;margin:0 0 4px;">${escapeHtml(title)}</h1>`,
    out.join("\n"),
    '<p style="margin-top:32px;color:#9ca3af;font-size:12px;">YouTube Summarizer · AI 동향 위클리</p>',
    "</div>",
  ].join("\n");
}
