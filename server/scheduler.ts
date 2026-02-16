import { getUserSubscriptions, saveVideo, saveSummary, getAllUsersWithEmailEnabled, getUserSettings } from "./db";
import { getChannelVideos } from "./youtube";
import { generateVideoSummary } from "./summarizer";
import { sendSummaryEmail, VideoSummaryData } from "./mailer";

/**
 * Fetch new videos from all subscribed channels for a user
 */
export async function fetchNewVideosForUser(userId: number): Promise<void> {
  try {
    const subscriptions = await getUserSubscriptions(userId);
    
    if (subscriptions.length === 0) {
      console.log(`User ${userId} has no subscriptions`);
      return;
    }

    console.log(`Fetching videos for user ${userId} from ${subscriptions.length} channels`);

    // Fetch videos from last 24 hours
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    for (const sub of subscriptions) {
      try {
        const videos = await getChannelVideos(sub.channelId, 5, yesterday);
        
        for (const video of videos) {
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

          // Generate and save summary
          const summaryResult = await generateVideoSummary(video.videoId, video.title, video.description, video.duration);
          await saveSummary({
            videoId: video.videoId,
            userId,
            summary: summaryResult.brief,
            detailedSummary: summaryResult.detailed,
          });

          console.log(`Processed video: ${video.title}`);
        }
      } catch (error) {
        console.error(`Error processing channel ${sub.channelId}:`, error);
      }
    }
  } catch (error) {
    console.error(`Error fetching videos for user ${userId}:`, error);
  }
}

/**
 * Send daily summary email to a user
 */
export async function sendDailySummaryToUser(userId: number): Promise<boolean> {
  try {
    const settings = await getUserSettings(userId);
    
    if (!settings || !settings.emailEnabled) {
      console.log(`User ${userId} has email disabled`);
      return false;
    }

    const subscriptions = await getUserSubscriptions(userId);
    
    if (subscriptions.length === 0) {
      console.log(`User ${userId} has no subscriptions`);
      return false;
    }

    // Get recent videos from last 24 hours
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const summaryData: VideoSummaryData[] = [];

    for (const sub of subscriptions) {
      try {
        const videos = await getChannelVideos(sub.channelId, 5, yesterday);
        
        for (const video of videos) {
          const summaryResult = await generateVideoSummary(video.videoId, video.title, video.description, video.duration);
          
          summaryData.push({
            videoId: video.videoId,
            title: video.title,
            channelName: sub.channelName,
            thumbnailUrl: video.thumbnailUrl,
            summary: summaryResult.brief,
            publishedAt: video.publishedAt,
          });
        }
      } catch (error) {
        console.error(`Error processing channel ${sub.channelId}:`, error);
      }
    }

    if (summaryData.length === 0) {
      console.log(`No new videos for user ${userId}`);
      return false;
    }

    // Send email
    const success = await sendSummaryEmail(settings.email, `User ${userId}`, summaryData);
    
    if (success) {
      console.log(`Sent summary email to user ${userId} with ${summaryData.length} videos`);
    }

    return success;
  } catch (error) {
    console.error(`Error sending daily summary to user ${userId}:`, error);
    return false;
  }
}

/**
 * Process daily summaries for all users
 * This should be called by a cron job or scheduled task
 */
export async function processDailySummaries(): Promise<void> {
  console.log("Starting daily summary processing...");
  
  try {
    const usersWithEmail = await getAllUsersWithEmailEnabled();
    
    console.log(`Processing summaries for ${usersWithEmail.length} users`);

    for (const userSettings of usersWithEmail) {
      try {
        // Check if it's time to send based on frequency
        const shouldSend = shouldSendSummary(userSettings.summaryFrequency, userSettings.lastEmailSent);
        
        if (!shouldSend) {
          console.log(`Skipping user ${userSettings.userId} - not time to send yet`);
          continue;
        }

        await sendDailySummaryToUser(userSettings.userId);
      } catch (error) {
        console.error(`Error processing user ${userSettings.userId}:`, error);
      }
    }

    console.log("Daily summary processing completed");
  } catch (error) {
    console.error("Error in processDailySummaries:", error);
  }
}

/**
 * Check if it's time to send summary based on frequency and last sent time
 */
function shouldSendSummary(frequency: "daily" | "weekly", lastSent: Date | null): boolean {
  if (!lastSent) {
    return true; // Never sent before
  }

  const now = Date.now();
  const lastSentTime = lastSent.getTime();
  const hoursSinceLastSent = (now - lastSentTime) / (1000 * 60 * 60);

  if (frequency === "daily") {
    return hoursSinceLastSent >= 24;
  } else if (frequency === "weekly") {
    return hoursSinceLastSent >= 24 * 7;
  }

  return false;
}
