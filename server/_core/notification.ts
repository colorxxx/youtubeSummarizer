import { TRPCError } from "@trpc/server";
import nodemailer from "nodemailer";
import { ENV } from "./env";
import { createLogger } from "./logger";

const log = createLogger("Notification");

export type NotificationPayload = {
  title: string;
  content: string;
};

const TITLE_MAX_LENGTH = 1200;
const CONTENT_MAX_LENGTH = 20000;

const trimValue = (value: string): string => value.trim();
const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const validatePayload = (input: NotificationPayload): NotificationPayload => {
  if (!isNonEmptyString(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required.",
    });
  }
  if (!isNonEmptyString(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required.",
    });
  }

  const title = trimValue(input.title);
  const content = trimValue(input.content);

  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`,
    });
  }

  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`,
    });
  }

  return { title, content };
};

/** Gmail SMTP transporter (lazy-initialized) */
let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;
  if (!ENV.gmailAppPassword) return null;

  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: ENV.premiumEmail,
      pass: ENV.gmailAppPassword,
    },
  });
  return transporter;
}

/**
 * Send notification to the owner.
 * Uses Gmail SMTP if GMAIL_APP_PASSWORD is set, otherwise falls back to console.log.
 */
export async function notifyOwner(
  payload: NotificationPayload
): Promise<boolean> {
  const { title, content } = validatePayload(payload);

  const smtp = getTransporter();
  if (!smtp) {
    log.info(`[Fallback] ${title}: ${content}`);
    return true;
  }

  try {
    await smtp.sendMail({
      from: ENV.premiumEmail,
      to: ENV.premiumEmail,
      subject: `[YoutubeSummarizer] ${title}`,
      text: content,
    });
    log.info(`Email sent: ${title}`);
    return true;
  } catch (error) {
    log.error("Failed to send email:", error);
    log.info(`[Fallback] ${title}: ${content}`);
    return false;
  }
}
