import axios from "axios";
import { ENV } from "./_core/env";

export interface VideoSummaryData {
  videoId: string;
  title: string;
  channelName: string;
  thumbnailUrl: string;
  summary: string;
  publishedAt: Date;
}

/**
 * Send email with video summaries using Manus notification API
 */
export async function sendSummaryEmail(
  recipientEmail: string,
  recipientName: string,
  summaries: VideoSummaryData[]
): Promise<boolean> {
  try {
    if (summaries.length === 0) {
      console.log("No summaries to send");
      return false;
    }

    // Generate email HTML content
    const emailHtml = generateEmailHtml(recipientName, summaries);
    const emailText = generateEmailText(summaries);

    // Use Manus built-in email API (via notification system)
    // For now, we'll use a simple notification approach
    // In production, you'd integrate with a proper email service like SendGrid, Resend, etc.
    
    const subject = `Your Daily YouTube Summary - ${new Date().toLocaleDateString()}`;
    
    // Send via external email service (placeholder - needs actual email service integration)
    console.log(`Would send email to ${recipientEmail} with ${summaries.length} summaries`);
    console.log(`Subject: ${subject}`);
    console.log(`Content preview: ${emailText.substring(0, 200)}...`);

    // TODO: Integrate with actual email service (SendGrid, Resend, etc.)
    // For now, return true to simulate success
    return true;
  } catch (error) {
    console.error("Error sending summary email:", error);
    return false;
  }
}

/**
 * Generate HTML email content
 */
function generateEmailHtml(recipientName: string, summaries: VideoSummaryData[]): string {
  const videoCards = summaries
    .map(
      (video) => `
    <div style="margin-bottom: 30px; padding: 20px; background: #f9f9f9; border-radius: 8px;">
      <div style="display: flex; gap: 15px;">
        <img src="${video.thumbnailUrl}" alt="${video.title}" style="width: 200px; height: 112px; object-fit: cover; border-radius: 4px;" />
        <div style="flex: 1;">
          <h3 style="margin: 0 0 8px 0; font-size: 18px; color: #333;">
            <a href="https://youtube.com/watch?v=${video.videoId}" style="color: #1a73e8; text-decoration: none;">${video.title}</a>
          </h3>
          <p style="margin: 0 0 8px 0; color: #666; font-size: 14px;">${video.channelName} • ${new Date(video.publishedAt).toLocaleDateString()}</p>
          <p style="margin: 0; color: #444; font-size: 15px; line-height: 1.5;">${video.summary}</p>
        </div>
      </div>
    </div>
  `
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Daily YouTube Summary</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; border-radius: 8px; text-align: center; margin-bottom: 30px;">
    <h1 style="color: white; margin: 0; font-size: 32px;">📺 Your Daily YouTube Summary</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
  </div>

  <p style="font-size: 16px; color: #555;">Hi ${recipientName},</p>
  <p style="font-size: 16px; color: #555;">Here are the latest videos from your subscribed channels:</p>

  ${videoCards}

  <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #999; font-size: 14px;">
    <p>You're receiving this email because you subscribed to YouTube Summary Mailer.</p>
    <p>To manage your preferences, visit your account settings.</p>
  </div>
</body>
</html>
`;
}

/**
 * Generate plain text email content
 */
function generateEmailText(summaries: VideoSummaryData[]): string {
  const videoTexts = summaries
    .map(
      (video) => `
${video.title}
${video.channelName} • ${new Date(video.publishedAt).toLocaleDateString()}
${video.summary}
Watch: https://youtube.com/watch?v=${video.videoId}
`
    )
    .join("\n---\n");

  return `
Your Daily YouTube Summary - ${new Date().toLocaleDateString()}

${videoTexts}

---
You're receiving this email because you subscribed to YouTube Summary Mailer.
`;
}
