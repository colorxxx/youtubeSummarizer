import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";

export const youtubeRouter = router({
  searchChannels: protectedProcedure
    .input(z.object({ query: z.string(), maxResults: z.number().optional() }))
    .query(async ({ input }) => {
      const { searchChannels } = await import("../youtube");
      return searchChannels(input.query, input.maxResults);
    }),
});
