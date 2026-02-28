import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { processVideosInBackground } from "../backgroundTasks";

export const summariesRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(50).default(10),
        search: z.string().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const { getUserSummariesPaginated } = await import("../db");
      const page = input?.page ?? 1;
      const limit = input?.limit ?? 10;
      const search = input?.search;
      return getUserSummariesPaginated(ctx.user.id, page, limit, search);
    }),
  delete: protectedProcedure
    .input(z.object({ summaryId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { deleteSummary } = await import("../db");
      await deleteSummary(ctx.user.id, input.summaryId);
      return { success: true };
    }),
});

export const directSummaryRouter = router({
  summarize: protectedProcedure
    .input(z.object({ url: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { extractVideoId, getVideoDetails } = await import("../youtube");
      const { saveVideo, getUserSummaryForVideo } = await import("../db");

      const videoId = extractVideoId(input.url);
      if (!videoId) {
        throw new Error("유효하지 않은 YouTube URL입니다");
      }

      const videoDetails = await getVideoDetails(videoId);
      if (!videoDetails) {
        throw new Error("영상 정보를 가져올 수 없습니다");
      }

      const existingSummary = await getUserSummaryForVideo(ctx.user.id, videoId);
      if (existingSummary) {
        return { success: true, message: "이미 요약된 영상입니다", videoId };
      }

      await saveVideo({
        videoId: videoDetails.videoId,
        channelId: videoDetails.channelId,
        title: videoDetails.title,
        description: videoDetails.description,
        publishedAt: videoDetails.publishedAt,
        thumbnailUrl: videoDetails.thumbnailUrl,
        duration: videoDetails.duration,
      });

      processVideosInBackground({
        userId: ctx.user.id,
        channelId: "direct",
        channelName: "직접 요약",
        videos: [videoDetails],
        source: "direct",
        userEmail: ctx.user.email,
      });

      return { success: true, message: "요약을 생성 중입니다", videoId };
    }),
  history: protectedProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(50).default(10),
        search: z.string().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const { getDirectSummariesPaginated } = await import("../db");
      const page = input?.page ?? 1;
      const limit = input?.limit ?? 10;
      const search = input?.search;
      return getDirectSummariesPaginated(ctx.user.id, page, limit, search);
    }),
});
