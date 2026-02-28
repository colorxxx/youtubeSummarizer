import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";

export const settingsRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const { getUserSettings } = await import("../db");
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
      const { upsertUserSettings } = await import("../db");
      await upsertUserSettings({
        userId: ctx.user.id,
        email: input.email,
        emailEnabled: input.emailEnabled ? 1 : 0,
        summaryFrequency: input.summaryFrequency,
        videoCount: input.videoCount,
      });
      return { success: true };
    }),
});
