import axios from "axios";
import { YoutubeTranscript } from "youtube-transcript";
import { parseDuration } from "./videoUtils";

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
    console.error("Error searching YouTube channels:", error);
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
    console.error("Error fetching channel details:", error);
    throw new Error("Failed to fetch channel details");
  }
}

/**
 * Get recent videos from a channel
 */
export async function getChannelVideos(
  channelId: string,
  maxResults: number = 10,
  publishedAfter?: Date
): Promise<YouTubeVideo[]> {
  try {
    // First, search for videos from the channel
    const searchParams: any = {
      part: "snippet",
      channelId,
      type: "video",
      order: "date",
      maxResults,
      key: getApiKey(),
    };

    if (publishedAfter) {
      searchParams.publishedAfter = publishedAfter.toISOString();
    }

    const searchResponse = await axios.get(`${YOUTUBE_API_BASE}/search`, {
      params: searchParams,
    });

    if (!searchResponse.data.items || searchResponse.data.items.length === 0) {
      return [];
    }

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

    const videos: YouTubeVideo[] = videosResponse.data.items
      .map((item: any) => ({
        videoId: item.id,
        channelId: item.snippet.channelId,
        title: item.snippet.title,
        description: item.snippet.description,
        publishedAt: new Date(item.snippet.publishedAt),
        thumbnailUrl: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url || "",
        duration: item.contentDetails.duration,
      }))
      .filter((v: YouTubeVideo) => parseDuration(v.duration) > 60); // Shorts(60초 이하) 제외

    return videos;
  } catch (error) {
    console.error("Error fetching channel videos:", error);
    throw new Error("Failed to fetch channel videos");
  }
}

/**
 * Get video transcript/captions using youtube-transcript library
 * Falls back to null if transcript is not available
 */
export async function getVideoTranscript(videoId: string): Promise<VideoTranscript> {
  try {
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    
    if (!transcript || transcript.length === 0) {
      return { text: "", available: false };
    }

    // Combine all transcript segments into a single text
    const fullText = transcript.map((item: any) => item.text).join(" ");
    
    return { text: fullText, available: true };
  } catch (error) {
    // Transcript not available or error occurred
    console.log(`Transcript not available for video ${videoId}:`, error instanceof Error ? error.message : "Unknown error");
    return { text: "", available: false };
  }
}
