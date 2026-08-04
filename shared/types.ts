/**
 * Unified type exports
 * Import shared types from this single entry point.
 */

export type * from "../drizzle/schema";
export * from "./_core/errors";

/** Structured newsletter payload stored in newsletters.data (JSON) */
export type NewsletterVideo = {
  videoId: string;
  channelId: string;
  channelName: string;
  title: string;
  publishedAt: string; // ISO
  thumbnailUrl: string | null;
  summary: string;
};

export type NewsletterTrend = {
  heading: string;
  body: string;
  videoIds: string[];
};

export type NewsletterData = {
  tldr: string[];
  trends: NewsletterTrend[];
  videos: NewsletterVideo[];
};
