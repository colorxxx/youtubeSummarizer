import { invokeLLM, selectProviderForUser, type LLMProvider } from "./_core/llm";
import { createLogger } from "./_core/logger";
import {
  saveNewsletter,
  getWeeklySummariesForChannels,
  type WeeklySummaryRow,
} from "./db";
import type { Newsletter } from "../drizzle/schema";
import type { NewsletterData, NewsletterTrend, NewsletterVideo } from "@shared/types";

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
  trends: NewsletterTrend[];
};

export function videoThumbnail(video: { videoId: string; thumbnailUrl?: string | null }): string {
  return video.thumbnailUrl || `https://i.ytimg.com/vi/${video.videoId}/mqdefault.jpg`;
}

async function generateEditorial(
  rows: WeeklySummaryRow[],
  weekStart: Date,
  weekEnd: Date,
  provider: LLMProvider,
): Promise<Editorial> {
  const videoLines = rows
    .map((r) => {
      const detail = (r.detailedSummary ?? r.summary).slice(0, 1500);
      return `videoId: ${r.videoId}\n[${r.channelName}] ${r.title} (${formatKstShort(r.publishedAt)})\n${detail}`;
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
            '  "trends": [{ "heading": "짧은 트렌드 제목", "body": "3~5문장의 분석. 어떤 채널/영상에서 다뤘는지 자연스럽게 언급.", "videoIds": ["해당 트렌드의 근거가 된 영상의 videoId 2~4개"] }] }',
            "trends는 여러 채널에 걸쳐 나타난 주요 트렌드 2~4개를 담습니다.",
            "videoIds에는 반드시 위 입력에 있는 videoId만 사용하세요.",
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

  // Drop hallucinated video references
  const validIds = new Set(rows.map((r) => r.videoId));
  for (const trend of parsed.trends) {
    trend.videoIds = (trend.videoIds ?? []).filter((id) => validIds.has(id));
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

  const data: NewsletterData = {
    tldr: editorial.tldr,
    trends: editorial.trends,
    videos: rows.map(
      (r): NewsletterVideo => ({
        videoId: r.videoId,
        channelId: r.channelId,
        channelName: r.channelName,
        title: r.title,
        publishedAt: r.publishedAt.toISOString(),
        thumbnailUrl: r.thumbnailUrl,
        summary: r.summary,
      }),
    ),
  };

  const saved = await saveNewsletter({
    userId,
    topic: NEWSLETTER_TOPIC,
    title: editorial.title,
    weekStart,
    weekEnd,
    content,
    data: JSON.stringify(data),
    videoCount: rows.length,
  });

  log.info(`Newsletter saved: "${editorial.title}" (id: ${saved?.id})`);
  return { status: "generated", newsletter: saved! };
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Rich HTML email built from structured newsletter data (thumbnails included). */
export function renderEmailFromData(
  title: string,
  weekStart: Date,
  weekEnd: Date,
  data: NewsletterData,
): string {
  const periodLabel = `${formatKstDate(weekStart)} ~ ${formatKstDate(new Date(weekEnd.getTime() - 1))}`;
  const videoMap = new Map(data.videos.map((v) => [v.videoId, v]));

  const tldrItems = data.tldr
    .map(
      (t) =>
        `<tr><td style="padding:4px 10px 4px 0;vertical-align:top;color:#dc2626;font-weight:700;">›</td><td style="padding:4px 0;line-height:1.6;color:#1f2937;">${escapeHtml(t)}</td></tr>`,
    )
    .join("");

  const trendBlocks = data.trends
    .map((trend) => {
      const thumbs = trend.videoIds
        .map((id) => videoMap.get(id))
        .filter((v): v is NewsletterVideo => Boolean(v))
        .slice(0, 3)
        .map(
          (v) =>
            `<td style="padding-right:8px;"><a href="https://www.youtube.com/watch?v=${v.videoId}"><img src="${videoThumbnail(v)}" width="150" alt="${escapeHtml(v.title)}" style="display:block;border-radius:8px;width:150px;height:auto;"/></a></td>`,
        )
        .join("");
      return [
        `<h3 style="margin:24px 0 8px;font-size:16px;color:#111827;">${escapeHtml(trend.heading)}</h3>`,
        `<p style="margin:0 0 10px;line-height:1.7;color:#374151;">${escapeHtml(trend.body)}</p>`,
        thumbs ? `<table cellpadding="0" cellspacing="0" border="0"><tr>${thumbs}</tr></table>` : "",
      ].join("\n");
    })
    .join("\n");

  const byChannel = new Map<string, NewsletterVideo[]>();
  for (const v of data.videos) {
    if (!byChannel.has(v.channelId)) byChannel.set(v.channelId, []);
    byChannel.get(v.channelId)!.push(v);
  }

  const channelBlocks = Array.from(byChannel.values())
    .sort((a, b) => b.length - a.length)
    .map((channelVideos) => {
      const name = channelVideos[0].channelName;
      const items = channelVideos
        .map((v) => {
          const date = formatKstShort(new Date(v.publishedAt));
          return [
            '<tr>',
            `<td style="padding:10px 14px 10px 0;vertical-align:top;width:150px;"><a href="https://www.youtube.com/watch?v=${v.videoId}"><img src="${videoThumbnail(v)}" width="150" alt="" style="display:block;border-radius:8px;width:150px;height:auto;"/></a></td>`,
            `<td style="padding:10px 0;vertical-align:top;"><a href="https://www.youtube.com/watch?v=${v.videoId}" style="color:#111827;font-weight:600;text-decoration:none;line-height:1.4;">${escapeHtml(v.title)}</a><div style="color:#9ca3af;font-size:12px;margin:3px 0 5px;">${date}</div><div style="color:#4b5563;font-size:13px;line-height:1.6;">${escapeHtml(v.summary.replace(/\n+/g, " ").slice(0, 220))}${v.summary.length > 220 ? "…" : ""}</div></td>`,
            "</tr>",
          ].join("");
        })
        .join("");
      return [
        `<h3 style="margin:26px 0 4px;font-size:15px;color:#111827;">${escapeHtml(name)} <span style="color:#9ca3af;font-weight:400;">· ${channelVideos.length}개</span></h3>`,
        `<table cellpadding="0" cellspacing="0" border="0" width="100%">${items}</table>`,
      ].join("\n");
    })
    .join("\n");

  return [
    '<div style="background:#f3f4f6;padding:24px 8px;">',
    '<div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px 28px;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Apple SD Gothic Neo,sans-serif;color:#111827;">',
    `<div style="color:#dc2626;font-weight:700;font-size:12px;letter-spacing:0.08em;">AI 동향 위클리</div>`,
    `<h1 style="font-size:23px;margin:6px 0 4px;line-height:1.35;">${escapeHtml(title)}</h1>`,
    `<div style="color:#6b7280;font-size:13px;margin-bottom:20px;">${periodLabel} · 영상 ${data.videos.length}개</div>`,
    '<div style="background:#fef2f2;border-radius:12px;padding:16px 18px;">',
    '<div style="font-weight:700;font-size:14px;margin-bottom:6px;color:#991b1b;">이번 주 한눈에</div>',
    `<table cellpadding="0" cellspacing="0" border="0">${tldrItems}</table>`,
    "</div>",
    `<h2 style="margin:28px 0 0;font-size:18px;border-bottom:2px solid #111827;padding-bottom:8px;">주요 트렌드</h2>`,
    trendBlocks,
    `<h2 style="margin:32px 0 0;font-size:18px;border-bottom:2px solid #111827;padding-bottom:8px;">채널별 하이라이트</h2>`,
    channelBlocks,
    '<p style="margin-top:32px;color:#9ca3af;font-size:12px;">YouTube Summarizer · AI 동향 위클리</p>',
    "</div></div>",
  ].join("\n");
}

/** Best email HTML for a saved newsletter: structured layout when data exists, markdown fallback otherwise. */
export function newsletterEmailHtml(newsletter: Newsletter): string {
  if (newsletter.data) {
    try {
      const data = JSON.parse(newsletter.data) as NewsletterData;
      return renderEmailFromData(newsletter.title, newsletter.weekStart, newsletter.weekEnd, data);
    } catch (error) {
      log.error("Failed to parse newsletter data, falling back to markdown:", error);
    }
  }
  return markdownToEmailHtml(newsletter.content, newsletter.title);
}

/** Minimal markdown → email HTML converter (headings, bold, links, lists). */
export function markdownToEmailHtml(markdown: string, title: string): string {
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
