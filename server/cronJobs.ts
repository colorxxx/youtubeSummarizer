import cron from "node-cron";
import { getAllSubscriptions, getSubscription, saveVideo, saveSummary, getVideoByVideoId } from "./db";
import { getChannelVideos } from "./youtube";
import { generateVideoSummary } from "./summarizer";
import { createLogger } from "./_core/logger";

const videoCheckLog = createLogger("VideoCheck");
const channelRefreshLog = createLogger("ChannelRefresh");
const cronLog = createLogger("Cron");

/**
 * Check for new videos from all subscribed channels and generate summaries
 */
export async function checkNewVideos() {
  videoCheckLog.info("Starting video check...");

  try {
    // Get all subscriptions from all users
    const allSubscriptions = await getAllSubscriptions();

    if (!allSubscriptions || allSubscriptions.length === 0) {
      videoCheckLog.info("No subscriptions found");
      return { success: true, message: "No subscriptions found", newVideos: 0 };
    }

    videoCheckLog.info(`Found ${allSubscriptions.length} subscriptions to check`);

    // Group subscriptions by channel to avoid duplicate API calls
    const channelMap = new Map<string, typeof allSubscriptions>();
    for (const sub of allSubscriptions) {
      if (!channelMap.has(sub.channelId)) {
        channelMap.set(sub.channelId, []);
      }
      channelMap.get(sub.channelId)!.push(sub);
    }

    videoCheckLog.info(`Checking ${channelMap.size} unique channels`);

    let totalNewVideos = 0;

    // Check each channel for new videos
    for (const [channelId, subs] of Array.from(channelMap.entries())) {
      try {
        // Get videos published in the last 24 hours
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        const videos = await getChannelVideos(channelId, 10, yesterday);

        if (videos.length === 0) {
          videoCheckLog.info(`No new videos for channel ${channelId}`);
          continue;
        }

        videoCheckLog.info(`Found ${videos.length} new videos for channel ${channelId}`);

        // Process each new video
        for (const video of videos) {
          // Check if we already have this video
          const existingVideo = await getVideoByVideoId(video.videoId);
          if (existingVideo) {
            videoCheckLog.info(`Video ${video.videoId} already exists, skipping`);
            continue;
          }

          totalNewVideos++;

          // Save video to database
          await saveVideo({
            videoId: video.videoId,
            channelId: video.channelId,
            title: video.title,
            description: video.description,
            publishedAt: video.publishedAt,
            thumbnailUrl: video.thumbnailUrl,
            duration: video.duration,
          });

          // Generate summaries for each user subscribed to this channel
          for (const sub of subs) {
            try {
              videoCheckLog.info(`Generating summary for video ${video.videoId}, user ${sub.userId}`);

              const { brief, detailed } = await generateVideoSummary(
                video.videoId,
                video.title,
                video.description,
                video.duration
              );

              await saveSummary({
                videoId: video.videoId,
                userId: sub.userId,
                summary: brief,
                detailedSummary: detailed,
              });

              videoCheckLog.info(`Summary saved for video ${video.videoId}, user ${sub.userId}`);
            } catch (error) {
              videoCheckLog.error(`Error generating summary for video ${video.videoId}, user ${sub.userId}:`, error);
            }
          }
        }
      } catch (error) {
        videoCheckLog.error(`Error processing channel ${channelId}:`, error);
      }
    }

    videoCheckLog.info(`Video check completed. Found ${totalNewVideos} new videos`);
    return { success: true, message: `Found ${totalNewVideos} new videos`, newVideos: totalNewVideos };
  } catch (error) {
    videoCheckLog.error("Error during video check:", error);
    throw error;
  }
}

/**
 * Check for new videos from a specific channel for a specific user
 */
export async function checkChannelVideos(userId: number, channelId: string) {
  channelRefreshLog.info(`Starting refresh for channel ${channelId}, user ${userId}`);

  const sub = await getSubscription(userId, channelId);
  if (!sub) {
    return { success: false, message: "Subscription not found", newVideos: 0 };
  }

  const videoCount = sub.videoCount || 3;
  const videos = await getChannelVideos(channelId, videoCount);

  if (videos.length === 0) {
    channelRefreshLog.info(`No videos found for channel ${channelId}`);
    return { success: true, message: "No videos found", newVideos: 0 };
  }

  let newVideos = 0;

  for (const video of videos) {
    const existing = await getVideoByVideoId(video.videoId);
    if (existing) {
      // Video exists, but check if this user already has a summary
      const { getUserSummaryForVideo } = await import("./db");
      const existingSummary = await getUserSummaryForVideo(userId, video.videoId);
      if (existingSummary) {
        channelRefreshLog.info(`Summary already exists for video ${video.videoId}, skipping`);
        continue;
      }
    } else {
      await saveVideo({
        videoId: video.videoId,
        channelId: video.channelId,
        title: video.title,
        description: video.description,
        publishedAt: video.publishedAt,
        thumbnailUrl: video.thumbnailUrl,
        duration: video.duration,
      });
    }

    try {
      const { brief, detailed } = await generateVideoSummary(
        video.videoId,
        video.title,
        video.description,
        video.duration
      );

      await saveSummary({
        videoId: video.videoId,
        userId,
        summary: brief,
        detailedSummary: detailed,
      });

      newVideos++;
      channelRefreshLog.info(`Summary saved for video ${video.videoId}`);
    } catch (error) {
      channelRefreshLog.error(`Error generating summary for video ${video.videoId}:`, error);
    }
  }

  channelRefreshLog.info(`Completed. ${newVideos} new summaries generated`);
  return { success: true, message: `${newVideos}개의 새 요약이 생성되었습니다`, newVideos };
}

/**
 * Start the daily cron job
 * Runs daily at 11:00 AM KST
 */
export function startDailyVideoCheckJob() {
  // Run every day at 11:00 AM KST
  // Cron format: second minute hour day month weekday
  cron.schedule("0 0 11 * * *", async () => {
    cronLog.info("Starting daily video check job...");
    try {
      const result = await checkNewVideos();
      cronLog.info(`Daily video check job completed: ${result.message}`);
    } catch (error) {
      cronLog.error("Error in daily video check job:", error);
    }
  }, {
    timezone: "Asia/Seoul"
  });

  cronLog.info("Daily video check job scheduled (11:00 AM KST)");
}

/**
 * Initialize all cron jobs
 */
export function initializeCronJobs() {
  cronLog.info("Initializing cron jobs...");
  startDailyVideoCheckJob();
  cronLog.info("All cron jobs initialized");
}
