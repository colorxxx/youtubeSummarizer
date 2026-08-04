import cron from "node-cron";
import { getAllSubscriptions, getSubscription, saveVideo, saveSummary, getVideoByVideoId, getUserSummaryForVideo } from "./db";
import { getChannelVideos } from "./youtube";
import { generateVideoSummary } from "./summarizer";
import { selectProviderForUser } from "./_core/llm";
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
          const existingVideo = await getVideoByVideoId(video.videoId);

          if (!existingVideo) {
            totalNewVideos++;
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

          // Generate summaries for each user subscribed to this channel
          for (const sub of subs) {
            try {
              // Skip if this user already has a summary for this video
              const existingSummary = await getUserSummaryForVideo(sub.userId, video.videoId);
              if (existingSummary) {
                videoCheckLog.info(`Summary exists for video ${video.videoId}, user ${sub.userId}, skipping`);
                continue;
              }

              const provider = await selectProviderForUser(sub.userId, null);
              videoCheckLog.info(`Generating summary for video ${video.videoId}, user ${sub.userId} (provider: ${provider})`);

              const { brief, detailed } = await generateVideoSummary(
                video.videoId,
                video.title,
                video.description,
                video.duration,
                provider,
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
      const provider = await selectProviderForUser(userId, null);
      const { brief, detailed } = await generateVideoSummary(
        video.videoId,
        video.title,
        video.description,
        video.duration,
        provider,
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
 * Generate last week's AI trends newsletter for every user subscribed to
 * at least one AI channel, and email it when the user has email enabled.
 */
export async function runWeeklyNewsletterJob() {
  const { generateWeeklyNewsletter, markdownToEmailHtml, AI_TREND_CHANNELS } = await import("./newsletter");
  const { getUserSettings, markNewsletterEmailSent } = await import("./db");
  const { getDb } = await import("./db");
  const { sendEmail } = await import("./_core/notification");
  const { users } = await import("../drizzle/schema");
  const { inArray, eq } = await import("drizzle-orm");

  const allSubscriptions = await getAllSubscriptions();
  const aiChannelIds = new Set(Object.keys(AI_TREND_CHANNELS));
  const userIds = Array.from(
    new Set(allSubscriptions.filter((s) => aiChannelIds.has(s.channelId)).map((s) => s.userId)),
  );

  cronLog.info(`Weekly newsletter: ${userIds.length} user(s) with AI channel subscriptions`);

  const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  for (const userId of userIds) {
    try {
      const db = await getDb();
      const [user] = db
        ? await db.select().from(users).where(eq(users.id, userId)).limit(1)
        : [];

      const result = await generateWeeklyNewsletter(userId, user?.email ?? null, lastWeek);
      if (result.status === "empty") continue;

      const settings = await getUserSettings(userId);
      const to = settings?.emailEnabled ? settings.email || user?.email : null;
      if (!to) {
        cronLog.info(`Newsletter generated for user ${userId}, email disabled or missing`);
        continue;
      }

      const html = markdownToEmailHtml(result.newsletter.content, result.newsletter.title);
      const sent = await sendEmail({
        to,
        subject: `[AI 동향 위클리] ${result.newsletter.title}`,
        html,
      });
      if (sent) await markNewsletterEmailSent(result.newsletter.id);
    } catch (error) {
      cronLog.error(`Weekly newsletter failed for user ${userId}:`, error);
    }
  }
}

/**
 * Start the weekly newsletter job.
 * Runs every Monday at 8:00 AM KST, covering the previous week.
 */
export function startWeeklyNewsletterJob() {
  cron.schedule("0 0 8 * * 1", async () => {
    cronLog.info("Starting weekly newsletter job...");
    try {
      await runWeeklyNewsletterJob();
      cronLog.info("Weekly newsletter job completed");
    } catch (error) {
      cronLog.error("Error in weekly newsletter job:", error);
    }
  }, {
    timezone: "Asia/Seoul"
  });

  cronLog.info("Weekly newsletter job scheduled (Monday 8:00 AM KST)");
}

/**
 * Initialize all cron jobs
 */
export function initializeCronJobs() {
  cronLog.info("Initializing cron jobs...");
  startDailyVideoCheckJob();
  startWeeklyNewsletterJob();
  cronLog.info("All cron jobs initialized");
}
