import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * YouTube channel subscriptions
 */
export const subscriptions = mysqlTable("subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  channelId: varchar("channelId", { length: 255 }).notNull(),
  channelName: varchar("channelName", { length: 255 }).notNull(),
  channelThumbnail: text("channelThumbnail"),
  videoCount: int("videoCount").default(3),
  addedAt: timestamp("addedAt").defaultNow().notNull(),
});

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = typeof subscriptions.$inferInsert;

/**
 * YouTube videos from subscribed channels
 */
export const videos = mysqlTable("videos", {
  id: int("id").autoincrement().primaryKey(),
  videoId: varchar("videoId", { length: 255 }).notNull().unique(),
  channelId: varchar("channelId", { length: 255 }).notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  publishedAt: timestamp("publishedAt").notNull(),
  thumbnailUrl: text("thumbnailUrl"),
  duration: varchar("duration", { length: 50 }),
  transcript: text("transcript"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Video = typeof videos.$inferSelect;
export type InsertVideo = typeof videos.$inferInsert;

/**
 * AI-generated summaries for videos
 */
export const summaries = mysqlTable("summaries", {
  id: int("id").autoincrement().primaryKey(),
  videoId: varchar("videoId", { length: 255 }).notNull(),
  userId: int("userId").notNull(),
  summary: text("summary").notNull(), // Brief summary (3-5 sentences)
  detailedSummary: text("detailedSummary"), // Detailed summary (length varies by video duration)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Summary = typeof summaries.$inferSelect;
export type InsertSummary = typeof summaries.$inferInsert;

/**
 * User email and notification settings
 */
export const userSettings = mysqlTable("userSettings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  email: varchar("email", { length: 320 }).notNull(),
  emailEnabled: int("emailEnabled").default(1).notNull(), // 1 = enabled, 0 = disabled
  summaryFrequency: mysqlEnum("summaryFrequency", ["daily", "weekly"]).default("daily").notNull(),
  videoCount: int("videoCount").default(3).notNull(), // Number of videos to summarize per channel (1-10)
  lastEmailSent: timestamp("lastEmailSent"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserSettings = typeof userSettings.$inferSelect;
export type InsertUserSettings = typeof userSettings.$inferInsert;

/**
 * Chat messages for video-specific AI conversations
 */
export const chatMessages = mysqlTable("chatMessages", {
  id: int("id").autoincrement().primaryKey(),
  videoId: varchar("videoId", { length: 255 }).notNull(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", ["user", "assistant"]).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;