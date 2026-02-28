import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { processVideosInBackground } from "../backgroundTasks";

export const subscriptionsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const { getUserSubscriptions } = await import("../db");
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
      const { addSubscription, isChannelSubscribed, getUserSettings } = await import("../db");

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

      // Fetch videos and process in background
      const { getChannelVideos } = await import("../youtube");
      const videos = await getChannelVideos(input.channelId, videoCount);

      processVideosInBackground({
        userId: ctx.user.id,
        channelId: input.channelId,
        channelName: input.channelName,
        videos,
      });

      return { success: true, message: "Channel subscribed! Summaries are being generated." };
    }),
  remove: protectedProcedure
    .input(z.object({ channelId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { removeSubscription } = await import("../db");
      await removeSubscription(ctx.user.id, input.channelId);
      return { success: true };
    }),
  updateSettings: protectedProcedure
    .input(z.object({ channelId: z.string(), videoCount: z.number().min(1).max(10).nullable() }))
    .mutation(async ({ ctx, input }) => {
      const { updateSubscriptionSettings } = await import("../db");
      await updateSubscriptionSettings(ctx.user.id, input.channelId, input.videoCount);
      return { success: true };
    }),
});
