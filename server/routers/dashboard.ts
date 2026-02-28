import { createLogger } from "../_core/logger";
import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { processVideosInBackground } from "../backgroundTasks";

const log = createLogger("Router");

export const dashboardRouter = router({
  channelSummaries: protectedProcedure.query(async ({ ctx }) => {
    const { getSummariesGroupedByChannel } = await import("../db");
    return getSummariesGroupedByChannel(ctx.user.id);
  }),
  refreshVideos: protectedProcedure.mutation(async ({ ctx }) => {
    const { checkNewVideos } = await import("../cronJobs");
    try {
      const result = await checkNewVideos();
      return result;
    } catch (error) {
      log.error("Error refreshing videos:", error);
      throw new Error("Failed to check for new videos");
    }
  }),
  refreshChannel: protectedProcedure
    .input(z.object({ channelId: z.string(), channelName: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { getSubscription } = await import("../db");
      const sub = await getSubscription(ctx.user.id, input.channelId);

      if (!sub) {
        throw new Error("Subscription not found");
      }

      const channelName = input.channelName || sub.channelName;

      const { getChannelVideos } = await import("../youtube");
      const videoCount = sub.videoCount || 3;
      const videos = await getChannelVideos(input.channelId, videoCount);

      processVideosInBackground({
        userId: ctx.user.id,
        channelId: input.channelId,
        channelName: channelName,
        videos,
        skipExisting: true,
      });

      return { success: true, message: "새로고침을 시작했습니다" };
    }),
});
