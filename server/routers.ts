import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";

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
        
        // Background processing
        (async () => {
          try {
            const { saveVideo, saveSummary } = await import("./db");
            const { getChannelVideos } = await import("./youtube");
            const { generateVideoSummary } = await import("./summarizer");
            
            const videos = await getChannelVideos(input.channelId, videoCount);
            
            for (const video of videos) {
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
              } catch (error) {
                console.error(`Error processing video ${video.videoId}:`, error);
              }
            }
            console.log(`Background processing complete for channel ${input.channelId}`);
          } catch (error) {
            console.error(`Background processing failed:`, error);
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
    list: protectedProcedure.query(async ({ ctx }) => {
      const { getUserSummaries } = await import("./db");
      return getUserSummaries(ctx.user.id, 50);
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
