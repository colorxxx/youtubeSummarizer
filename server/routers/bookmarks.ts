import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";

export const bookmarksRouter = router({
  toggle: protectedProcedure
    .input(z.object({ videoId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { toggleBookmark } = await import("../db");
      return toggleBookmark(ctx.user.id, input.videoId);
    }),
  check: protectedProcedure
    .input(z.object({ videoIds: z.array(z.string()) }))
    .query(async ({ ctx, input }) => {
      const { getUserBookmarks } = await import("../db");
      const userBookmarks = await getUserBookmarks(ctx.user.id);
      const bookmarkedSet = new Set(userBookmarks.map((b) => b.videoId));
      const bookmarkedIds = input.videoIds.filter((id) => bookmarkedSet.has(id));
      return { bookmarkedIds };
    }),
  list: protectedProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(50).default(10),
        search: z.string().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const { getUserBookmarkedSummaries } = await import("../db");
      const page = input?.page ?? 1;
      const limit = input?.limit ?? 10;
      const search = input?.search;
      return getUserBookmarkedSummaries(ctx.user.id, page, limit, search);
    }),
});
