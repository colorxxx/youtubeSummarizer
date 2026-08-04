import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { createLogger } from "../_core/logger";

const log = createLogger("Router");

export const newslettersRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const { getUserNewsletters } = await import("../db");
    return getUserNewsletters(ctx.user.id);
  }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const { getNewsletterById } = await import("../db");
      const newsletter = await getNewsletterById(ctx.user.id, input.id);
      if (!newsletter) throw new Error("Newsletter not found");
      return newsletter;
    }),

  /** Generate (or regenerate) the newsletter for the week containing `date` (defaults to last week). */
  generate: protectedProcedure
    .input(z.object({ date: z.string().optional() }).optional())
    .mutation(async ({ ctx, input }) => {
      const { generateWeeklyNewsletter } = await import("../newsletter");
      const date = input?.date
        ? new Date(input.date)
        : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      try {
        const result = await generateWeeklyNewsletter(ctx.user.id, ctx.user.email, date);
        if (result.status === "empty") {
          return { success: false, message: "해당 주에 AI 채널 요약이 없습니다" };
        }
        return { success: true, message: "뉴스레터가 생성되었습니다", id: result.newsletter.id };
      } catch (error) {
        log.error("Error generating newsletter:", error);
        throw new Error("뉴스레터 생성에 실패했습니다");
      }
    }),

  sendEmail: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { getNewsletterById, getUserSettings, markNewsletterEmailSent } = await import("../db");
      const { markdownToEmailHtml } = await import("../newsletter");
      const { sendEmail } = await import("../_core/notification");

      const newsletter = await getNewsletterById(ctx.user.id, input.id);
      if (!newsletter) throw new Error("Newsletter not found");

      const settings = await getUserSettings(ctx.user.id);
      const to = settings?.email || ctx.user.email;
      if (!to) throw new Error("발송할 이메일 주소가 없습니다");

      const html = markdownToEmailHtml(newsletter.content, newsletter.title);
      const sent = await sendEmail({
        to,
        subject: `[AI 동향 위클리] ${newsletter.title}`,
        html,
      });

      if (!sent) throw new Error("이메일 발송에 실패했습니다");

      await markNewsletterEmailSent(newsletter.id);
      return { success: true, message: `${to}로 발송되었습니다` };
    }),
});
