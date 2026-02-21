import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import {
  createTask,
  updateTaskProgress,
  completeTask,
  failTask,
  getRecentTasks,
} from "./backgroundTasks";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  subscriptions: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const { getUserSubscriptions } = await import("./db");
      return getUserSubscriptions(ctx.user.id);
    }),
    add: protectedProcedure
      .input(
        z.object({
          channelId: z.string(),
          channelName: z.string(),
          channelThumbnail: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { addSubscription, isChannelSubscribed, getUserSettings } = await import("./db");
        
        const alreadySubscribed = await isChannelSubscribed(ctx.user.id, input.channelId);
        if (alreadySubscribed) {
          throw new Error("Already subscribed to this channel");
        }
        
        const settings = await getUserSettings(ctx.user.id);
        const videoCount = settings?.videoCount || 3;
        
        await addSubscription({
          userId: ctx.user.id,
          channelId: input.channelId,
          channelName: input.channelName,
          channelThumbnail: input.channelThumbnail || null,
          videoCount,
        });
        
        // Background processing with task tracking
        (async () => {
          const { saveVideo, saveSummary } = await import("./db");
          const { getChannelVideos } = await import("./youtube");
          const { generateVideoSummary } = await import("./summarizer");

          let taskId: string | null = null;

          try {
            const videos = await getChannelVideos(input.channelId, videoCount);

            if (videos.length === 0) {
              console.log(`No videos to process for channel ${input.channelId}`);
              return;
            }

            taskId = createTask(ctx.user.id, input.channelId, input.channelName, videos.length);

            for (let i = 0; i < videos.length; i++) {
              const video = videos[i];
              try {
                await saveVideo({
                  videoId: video.videoId,
                  channelId: video.channelId,
                  title: video.title,
                  description: video.description,
                  publishedAt: video.publishedAt,
                  thumbnailUrl: video.thumbnailUrl,
                  duration: video.duration,
                });

                const summaryResult = await generateVideoSummary(
                  video.videoId,
                  video.title,
                  video.description,
                  video.duration
                );

                await saveSummary({
                  videoId: video.videoId,
                  userId: ctx.user.id,
                  summary: summaryResult.brief,
                  detailedSummary: summaryResult.detailed,
                });

                updateTaskProgress(taskId, i + 1);
              } catch (error) {
                console.error(`Error processing video ${video.videoId}:`, error);
              }
            }

            completeTask(taskId);
            console.log(`Background processing complete for channel ${input.channelId}`);
          } catch (error) {
            console.error(`Background processing failed:`, error);
            if (taskId) {
              failTask(taskId, error instanceof Error ? error.message : "Unknown error");
            }
          }
        })();
        
        return { success: true, message: "Channel subscribed! Summaries are being generated." };
      }),
    remove: protectedProcedure
      .input(z.object({ channelId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const { removeSubscription } = await import("./db");
        await removeSubscription(ctx.user.id, input.channelId);
        return { success: true };
      }),
    updateSettings: protectedProcedure
      .input(z.object({ channelId: z.string(), videoCount: z.number().min(1).max(10).nullable() }))
      .mutation(async ({ ctx, input }) => {
        const { updateSubscriptionSettings } = await import("./db");
        await updateSubscriptionSettings(ctx.user.id, input.channelId, input.videoCount);
        return { success: true };
      }),
  }),

  dashboard: router({
    channelSummaries: protectedProcedure.query(async ({ ctx }) => {
      const { getSummariesGroupedByChannel } = await import("./db");
      return getSummariesGroupedByChannel(ctx.user.id);
    }),
    refreshVideos: protectedProcedure.mutation(async ({ ctx }) => {
      const { checkNewVideos } = await import("./cronJobs");
      try {
        const result = await checkNewVideos();
        return result;
      } catch (error) {
        console.error("[Dashboard] Error refreshing videos:", error);
        throw new Error("Failed to check for new videos");
      }
    }),
    refreshChannel: protectedProcedure
      .input(z.object({ channelId: z.string(), channelName: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const { getSubscription } = await import("./db");
        const sub = await getSubscription(ctx.user.id, input.channelId);

        if (!sub) {
          throw new Error("Subscription not found");
        }

        const channelName = input.channelName || sub.channelName;

        // Background processing with task tracking
        (async () => {
          const { getChannelVideos } = await import("./youtube");
          const { saveVideo, saveSummary, getVideoByVideoId, getUserSummaryForVideo } = await import("./db");
          const { generateVideoSummary } = await import("./summarizer");

          let taskId: string | null = null;

          try {
            const videoCount = sub.videoCount || 3;
            const videos = await getChannelVideos(input.channelId, videoCount);

            if (videos.length === 0) {
              console.log(`[ChannelRefresh] No videos found for channel ${input.channelId}`);
              return;
            }

            taskId = createTask(ctx.user.id, input.channelId, channelName, videos.length);

            for (let i = 0; i < videos.length; i++) {
              const video = videos[i];

              const existing = await getVideoByVideoId(video.videoId);
              if (existing) {
                const existingSummary = await getUserSummaryForVideo(ctx.user.id, video.videoId);
                if (existingSummary) {
                  updateTaskProgress(taskId, i + 1);
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
                  userId: ctx.user.id,
                  summary: brief,
                  detailedSummary: detailed,
                });
              } catch (error) {
                console.error(`[ChannelRefresh] Error generating summary for video ${video.videoId}:`, error);
              }

              updateTaskProgress(taskId, i + 1);
            }

            completeTask(taskId);
            console.log(`[ChannelRefresh] Completed for channel ${input.channelId}`);
          } catch (error) {
            console.error(`[ChannelRefresh] Failed:`, error);
            if (taskId) {
              failTask(taskId, error instanceof Error ? error.message : "Unknown error");
            }
          }
        })();

        return { success: true, message: "새로고침을 시작했습니다" };
      }),
  }),

  youtube: router({
    searchChannels: protectedProcedure
      .input(z.object({ query: z.string(), maxResults: z.number().optional() }))
      .query(async ({ input }) => {
        const { searchChannels } = await import("./youtube");
        return searchChannels(input.query, input.maxResults);
      }),
  }),

  videos: router({
    recent: protectedProcedure.query(async ({ ctx }) => {
      const { getUserSubscriptions, getRecentVideos } = await import("./db");
      const subs = await getUserSubscriptions(ctx.user.id);
      const channelIds = subs.map((s) => s.channelId);
      return getRecentVideos(channelIds, 50);
    }),
  }),

  summaries: router({
    list: protectedProcedure
      .input(
        z.object({
          page: z.number().min(1).default(1),
          limit: z.number().min(1).max(50).default(10),
          search: z.string().optional(),
        }).optional()
      )
      .query(async ({ ctx, input }) => {
        const { getUserSummariesPaginated } = await import("./db");
        const page = input?.page ?? 1;
        const limit = input?.limit ?? 10;
        const search = input?.search;
        return getUserSummariesPaginated(ctx.user.id, page, limit, search);
      }),
    delete: protectedProcedure
      .input(z.object({ summaryId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { deleteSummary } = await import("./db");
        await deleteSummary(ctx.user.id, input.summaryId);
        return { success: true };
      }),
  }),

  chat: router({
    history: protectedProcedure
      .input(z.object({ videoId: z.string() }))
      .query(async ({ ctx, input }) => {
        const { getChatHistory } = await import("./db");
        return getChatHistory(ctx.user.id, input.videoId);
      }),
    send: protectedProcedure
      .input(z.object({ videoId: z.string(), message: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const { getChatHistory, saveChatMessage, getUserSummaryForVideo, getVideoByVideoId } = await import("./db");
        const { invokeLLM } = await import("./_core/llm");
        const { buildChatMessages, buildSystemPrompt } = await import("./chatContext");

        // Get video info and summary for context
        const [video, summary, history] = await Promise.all([
          getVideoByVideoId(input.videoId),
          getUserSummaryForVideo(ctx.user.id, input.videoId),
          getChatHistory(ctx.user.id, input.videoId),
        ]);

        if (!video) throw new Error("영상 정보를 찾을 수 없습니다");

        // Build system prompt with video context and transcript
        const systemContent = await buildSystemPrompt(video, summary, input.videoId);

        // Build messages with token budget management
        const messages = await buildChatMessages(systemContent, history, input.message);

        // Save user message
        await saveChatMessage(ctx.user.id, input.videoId, "user", input.message);

        // Call LLM
        const result = await invokeLLM({ messages });
        const assistantContent =
          typeof result.choices[0]?.message?.content === "string"
            ? result.choices[0].message.content
            : "응답을 생성할 수 없습니다.";

        // Save assistant message
        await saveChatMessage(ctx.user.id, input.videoId, "assistant", assistantContent);

        return { role: "assistant" as const, content: assistantContent };
      }),
    clear: protectedProcedure
      .input(z.object({ videoId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const { deleteChatHistory } = await import("./db");
        await deleteChatHistory(ctx.user.id, input.videoId);
        return { success: true };
      }),
  }),

  backgroundTasks: router({
    list: protectedProcedure.query(({ ctx }) => {
      return getRecentTasks(ctx.user.id, 10);
    }),
  }),

  settings: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const { getUserSettings } = await import("./db");
      return getUserSettings(ctx.user.id);
    }),
    update: protectedProcedure
      .input(
        z.object({
          email: z.string().email(),
          emailEnabled: z.boolean(),
          summaryFrequency: z.enum(["daily", "weekly"]),
          videoCount: z.number().min(1).max(10),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { upsertUserSettings } = await import("./db");
        await upsertUserSettings({
          userId: ctx.user.id,
          email: input.email,
          emailEnabled: input.emailEnabled ? 1 : 0,
          summaryFrequency: input.summaryFrequency,
          videoCount: input.videoCount,
        });
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
