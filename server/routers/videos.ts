import { protectedProcedure, router } from "../_core/trpc";

export const videosRouter = router({
  recent: protectedProcedure.query(async ({ ctx }) => {
    const { getUserSubscriptions, getRecentVideos } = await import("../db");
    const subs = await getUserSubscriptions(ctx.user.id);
    const channelIds = subs.map((s) => s.channelId);
    return getRecentVideos(channelIds, 50);
  }),
});
