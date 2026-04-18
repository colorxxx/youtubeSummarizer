import axios from "axios";
import { execFile } from "child_process";
import { existsSync } from "fs";
import { mkdtemp, readdir, readFile, rm, stat, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { promisify } from "util";
import { createLogger } from "./_core/logger";
import { parseDuration } from "./videoUtils";

const execFileAsync = promisify(execFile);

const log = createLogger("YouTube");

// --- YouTube cookies for yt-dlp bot detection bypass ---
const YT_COOKIES_PATH = join(tmpdir(), "yt-cookies.txt");

/**
 * Initialize YouTube cookies file from base64-encoded environment variable.
 * Call once at server startup.
 */
export async function initYtCookies(): Promise<void> {
  const encoded = process.env.YT_COOKIES_BASE64;
  if (!encoded) {
    log.warn("YT_COOKIES_BASE64 not set — yt-dlp may be blocked by YouTube bot detection");
    return;
  }

  try {
    const decoded = Buffer.from(encoded, "base64").toString("utf-8");
    await writeFile(YT_COOKIES_PATH, decoded, "utf-8");
    log.info(`YouTube cookies written to ${YT_COOKIES_PATH} (${decoded.length} bytes)`);
  } catch (error) {
    log.error("Failed to initialize YouTube cookies:", error);
  }
}

/** Returns yt-dlp cookie args if cookie file exists */
function getYtCookieArgs(): string[] {
  return existsSync(YT_COOKIES_PATH) ? ["--cookies", YT_COOKIES_PATH] : [];
}

/**
 * YouTube Data API v3 integration helper
 * Requires YOUTUBE_API_KEY environment variable
 */

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

function getApiKey(): string {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error("YOUTUBE_API_KEY environment variable is not set");
  }
  return apiKey;
}

export interface YouTubeChannel {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  subscriberCount?: string;
}

export interface YouTubeVideo {
  videoId: string;
  channelId: string;
  title: string;
  description: string;
  publishedAt: Date;
  thumbnailUrl: string;
  duration: string;
}

export interface VideoTranscript {
  text: string;
  available: boolean;
}

/**
 * Search for YouTube channels by keyword
 */
export async function searchChannels(query: string, maxResults: number = 10): Promise<YouTubeChannel[]> {
  try {
    const response = await axios.get(`${YOUTUBE_API_BASE}/search`, {
      params: {
        part: "snippet",
        q: query,
        type: "channel",
        maxResults,
        key: getApiKey(),
      },
    });

    const channels: YouTubeChannel[] = response.data.items.map((item: any) => ({
      id: item.snippet.channelId,
      title: item.snippet.title,
      description: item.snippet.description,
      thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url || "",
    }));

    return channels;
  } catch (error) {
    log.error("Error searching YouTube channels:", error);
    throw new Error("Failed to search YouTube channels");
  }
}

/**
 * Get channel details by channel ID
 */
export async function getChannelDetails(channelId: string): Promise<YouTubeChannel | null> {
  try {
    const response = await axios.get(`${YOUTUBE_API_BASE}/channels`, {
      params: {
        part: "snippet,statistics",
        id: channelId,
        key: getApiKey(),
      },
    });

    if (!response.data.items || response.data.items.length === 0) {
      return null;
    }

    const item = response.data.items[0];
    return {
      id: item.id,
      title: item.snippet.title,
      description: item.snippet.description,
      thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url || "",
      subscriberCount: item.statistics?.subscriberCount,
    };
  } catch (error) {
    log.error("Error fetching channel details:", error);
    throw new Error("Failed to fetch channel details");
  }
}

/**
 * Get recent videos from a channel
 * Keeps fetching until we have maxResults videos that are over 3 minutes
 */
export async function getChannelVideos(
  channelId: string,
  maxResults: number = 10,
  publishedAfter?: Date
): Promise<YouTubeVideo[]> {
  try {
    const validVideos: YouTubeVideo[] = [];
    let nextPageToken: string | undefined;
    const maxIterations = 5; // 최대 5번까지 페이지네이션 (API 할당량 보호)
    let iterations = 0;

    while (validVideos.length < maxResults && iterations < maxIterations) {
      iterations++;

      // Search for videos from the channel
      const searchParams: any = {
        part: "snippet",
        channelId,
        type: "video",
        order: "date",
        maxResults: Math.min(maxResults * 2, 50), // 한 번에 더 많이 가져와서 필터링
        key: getApiKey(),
      };

      if (publishedAfter) {
        searchParams.publishedAfter = publishedAfter.toISOString();
      }

      if (nextPageToken) {
        searchParams.pageToken = nextPageToken;
      }

      const searchResponse = await axios.get(`${YOUTUBE_API_BASE}/search`, {
        params: searchParams,
      });

      if (!searchResponse.data.items || searchResponse.data.items.length === 0) {
        break; // 더 이상 영상이 없음
      }

      nextPageToken = searchResponse.data.nextPageToken;

      // Get video IDs
      const videoIds = searchResponse.data.items.map((item: any) => item.id.videoId).join(",");

      // Fetch video details including duration
      const videosResponse = await axios.get(`${YOUTUBE_API_BASE}/videos`, {
        params: {
          part: "snippet,contentDetails",
          id: videoIds,
          key: getApiKey(),
        },
      });

      const fetchedVideos: YouTubeVideo[] = videosResponse.data.items
        .map((item: any) => ({
          videoId: item.id,
          channelId: item.snippet.channelId,
          title: item.snippet.title,
          description: item.snippet.description,
          publishedAt: new Date(item.snippet.publishedAt),
          thumbnailUrl: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url || "",
          duration: item.contentDetails.duration,
        }))
        .filter((v: YouTubeVideo) => parseDuration(v.duration) > 180); // 3분 미만 영상 제외

      // 중복 제거하며 추가
      for (const video of fetchedVideos) {
        if (!validVideos.some((v) => v.videoId === video.videoId)) {
          validVideos.push(video);
          if (validVideos.length >= maxResults) break;
        }
      }

      // 더 이상 페이지가 없으면 종료
      if (!nextPageToken) break;
    }

    return validVideos;
  } catch (error) {
    log.error("Error fetching channel videos:", error);
    throw new Error("Failed to fetch channel videos");
  }
}

/**
 * Extract video ID from a YouTube URL
 * Supports watch, youtu.be, shorts, embed, and mobile formats
 */
export function extractVideoId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.replace(/^m\./, ""); // strip m. prefix

    if (hostname === "youtu.be") {
      // https://youtu.be/VIDEO_ID
      const id = parsed.pathname.slice(1).split("/")[0];
      return id || null;
    }

    if (hostname === "www.youtube.com" || hostname === "youtube.com") {
      const pathname = parsed.pathname;

      if (pathname === "/watch" || pathname.startsWith("/watch?")) {
        // https://www.youtube.com/watch?v=VIDEO_ID
        const id = parsed.searchParams.get("v");
        return id || null;
      }

      if (pathname.startsWith("/shorts/")) {
        // https://www.youtube.com/shorts/VIDEO_ID
        const id = pathname.slice("/shorts/".length).split("/")[0];
        return id || null;
      }

      if (pathname.startsWith("/embed/")) {
        // https://www.youtube.com/embed/VIDEO_ID
        const id = pathname.slice("/embed/".length).split("/")[0];
        return id || null;
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Get video metadata for a single video ID using YouTube Data API v3
 */
export async function getVideoDetails(videoId: string): Promise<YouTubeVideo | null> {
  try {
    const response = await axios.get(`${YOUTUBE_API_BASE}/videos`, {
      params: {
        part: "snippet,contentDetails",
        id: videoId,
        key: getApiKey(),
      },
    });

    if (!response.data.items || response.data.items.length === 0) {
      return null;
    }

    const item = response.data.items[0];
    return {
      videoId: item.id,
      channelId: item.snippet.channelId,
      title: item.snippet.title,
      description: item.snippet.description,
      publishedAt: new Date(item.snippet.publishedAt),
      thumbnailUrl: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url || "",
      duration: item.contentDetails.duration,
    };
  } catch (error) {
    log.error("Error fetching video details:", error);
    return null;
  }
}

/**
 * Parse VTT subtitle content into plain text.
 * Removes headers, timestamps, HTML tags, and deduplicates lines.
 */
function parseVtt(vtt: string): string {
  const lines = vtt.split("\n");
  const textLines: string[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    // Skip VTT header, metadata, timestamps, and cue indices
    if (
      line.startsWith("WEBVTT") ||
      line.startsWith("Kind:") ||
      line.startsWith("Language:") ||
      line.includes("-->") ||
      line.trim() === "" ||
      /^\d+$/.test(line.trim())
    ) {
      continue;
    }

    // Remove HTML tags (<c>, </c>, <00:00:01.234>, etc.) and decode entities
    const cleaned = line
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&nbsp;/g, " ")
      .trim();

    if (cleaned && !seen.has(cleaned)) {
      seen.add(cleaned);
      textLines.push(cleaned);
    }
  }

  return textLines.join(" ");
}

// --- Global rate limiter for yt-dlp transcript requests ---
const TRANSCRIPT_MIN_INTERVAL = 5000; // 5s between yt-dlp calls
let transcriptQueue: Promise<void> = Promise.resolve();
let lastTranscriptTime = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fallback: download audio via yt-dlp and transcribe via Groq Whisper API.
 * Returns null if GROQ_API_KEY is not set or transcription fails.
 */
async function fetchTranscriptViaWhisper(videoId: string): Promise<VideoTranscript | null> {
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) {
    log.info(`Groq Whisper fallback skipped for ${videoId}: GROQ_API_KEY not set`);
    return null;
  }

  const tempDir = await mkdtemp(join(tmpdir(), "yt-audio-"));
  const audioPath = join(tempDir, `${videoId}.mp3`);

  try {
    // Download audio only (low bitrate to stay under 25MB limit)
    await execFileAsync("yt-dlp", [
      ...getYtCookieArgs(),
      "-x",
      "--audio-format", "mp3",
      "--audio-quality", "5",
      "--no-warnings",
      "--quiet",
      "-o", audioPath,
      `https://www.youtube.com/watch?v=${videoId}`,
    ], { timeout: 120_000 });

    // Check file size (Groq limit: 25MB)
    const fileStat = await stat(audioPath);
    if (fileStat.size > 25 * 1024 * 1024) {
      log.warn(`Groq Whisper skipped for ${videoId}: audio too large (${(fileStat.size / 1024 / 1024).toFixed(1)}MB)`);
      return null;
    }

    log.info(`Audio downloaded for ${videoId}: ${(fileStat.size / 1024 / 1024).toFixed(1)}MB, sending to Groq Whisper`);

    // Send to Groq Whisper API using native FormData (Node 20+)
    const audioBuffer = await readFile(audioPath);
    const blob = new Blob([new Uint8Array(audioBuffer)], { type: "audio/mpeg" });
    const form = new FormData();
    form.append("file", blob, `${videoId}.mp3`);
    form.append("model", "whisper-large-v3");
    form.append("response_format", "text");
    form.append("language", "ko");

    const response = await fetch(
      "https://api.groq.com/openai/v1/audio/transcriptions",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${groqKey}` },
        body: form,
        signal: AbortSignal.timeout(120_000),
      },
    );

    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      throw new Error(`Groq API ${response.status}: ${errBody}`);
    }

    const text = (await response.text()).trim();

    if (text.length > 0) {
      log.info(`Groq Whisper transcript for ${videoId}: ${text.length} chars`);
      return { text, available: true };
    }

    return null;
  } catch (error) {
    log.warn(
      `Groq Whisper fallback failed for ${videoId}:`,
      error instanceof Error ? error.message : "Unknown error",
    );
    return null;
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Internal implementation: fetch transcript via yt-dlp CLI.
 * Falls back to Groq Whisper STT if subtitle download fails.
 */
async function fetchTranscriptImpl(videoId: string): Promise<VideoTranscript> {
  const tempDir = await mkdtemp(join(tmpdir(), "yt-sub-"));

  try {
    // yt-dlp may exit with code 1 even when some subtitles downloaded successfully
    // (e.g. ko succeeds but en fails with 429). We must check for files regardless.
    try {
      await execFileAsync("yt-dlp", [
        ...getYtCookieArgs(),
        "--write-sub",
        "--write-auto-sub",
        "--sub-lang", "ko,en",
        "--sub-format", "vtt",
        "--skip-download",
        "--no-warnings",
        "--quiet",
        "-o", join(tempDir, "%(id)s"),
        `https://www.youtube.com/watch?v=${videoId}`,
      ], { timeout: 30_000 });
    } catch (cmdError) {
      // yt-dlp exited non-zero — log but continue to check for partial downloads
      log.info(
        `yt-dlp exited with error for ${videoId} (checking for partial downloads):`,
        cmdError instanceof Error ? cmdError.message : "Unknown error",
      );
    }

    // Find downloaded .vtt file — prefer ko over en
    const files = await readdir(tempDir);
    const koFile = files.find(f => f.includes(".ko.") && f.endsWith(".vtt"));
    const enFile = files.find(f => f.includes(".en.") && f.endsWith(".vtt"));
    const vttFile = koFile ?? enFile ?? files.find(f => f.endsWith(".vtt"));

    if (!vttFile) {
      log.info(`No subtitle files found for ${videoId}, trying Groq Whisper fallback`);
      // Clean up subtitle temp dir before Whisper attempt
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
      const whisperResult = await fetchTranscriptViaWhisper(videoId);
      return whisperResult ?? { text: "", available: false };
    }

    const vttContent = await readFile(join(tempDir, vttFile), "utf-8");
    const text = parseVtt(vttContent);

    if (text.length > 0) {
      log.info(`Transcript extracted for ${videoId}: ${text.length} chars (${vttFile})`);
      return { text, available: true };
    }
    return { text: "", available: false };
  } catch (error) {
    log.info(
      `Transcript not available for video ${videoId}:`,
      error instanceof Error ? error.message : "Unknown error",
    );
    return { text: "", available: false };
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Get video transcript/captions using yt-dlp CLI.
 * Serialized through a global Promise-chain queue with minimum 5s interval
 * to prevent YouTube 429 (Too Many Requests) errors.
 */
export function getVideoTranscript(videoId: string): Promise<VideoTranscript> {
  const resultPromise = new Promise<VideoTranscript>((resolve, reject) => {
    transcriptQueue = transcriptQueue
      .then(async () => {
        const elapsed = Date.now() - lastTranscriptTime;
        if (elapsed < TRANSCRIPT_MIN_INTERVAL) {
          const wait = TRANSCRIPT_MIN_INTERVAL - elapsed;
          log.info(`Rate limit: waiting ${wait}ms before fetching transcript for ${videoId}`);
          await sleep(wait);
        }
        lastTranscriptTime = Date.now();
        const result = await fetchTranscriptImpl(videoId);
        resolve(result);
      })
      .catch((error) => {
        reject(error);
      });
  });

  // Keep the queue chain alive even if this request fails
  transcriptQueue = transcriptQueue.then(() => {}, () => {});

  return resultPromise;
}
