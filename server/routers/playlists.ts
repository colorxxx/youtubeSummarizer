import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";

export const playlistsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const { getUserPlaylists } = await import("../db");
    return getUserPlaylists(ctx.user.id);
  }),
  create: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(255), description: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { createPlaylist } = await import("../db");
      return createPlaylist(ctx.user.id, input.name, input.description);
    }),
  update: protectedProcedure
    .input(z.object({ playlistId: z.number(), name: z.string().min(1).max(255), description: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { updatePlaylist } = await import("../db");
      await updatePlaylist(ctx.user.id, input.playlistId, input.name, input.description);
      return { success: true };
    }),
  delete: protectedProcedure
    .input(z.object({ playlistId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { deletePlaylist } = await import("../db");
      await deletePlaylist(ctx.user.id, input.playlistId);
      return { success: true };
    }),
  videos: protectedProcedure
    .input(z.object({ playlistId: z.number(), page: z.number().min(1).default(1), limit: z.number().min(1).max(50).default(10) }))
    .query(async ({ ctx, input }) => {
      const { getPlaylistVideos } = await import("../db");
      return getPlaylistVideos(ctx.user.id, input.playlistId, input.page, input.limit);
    }),
  addVideo: protectedProcedure
    .input(z.object({ playlistId: z.number(), videoId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { addVideoToPlaylist, getUserPlaylists } = await import("../db");
      const userPlaylists = await getUserPlaylists(ctx.user.id);
      if (!userPlaylists.some((p) => p.id === input.playlistId)) {
        throw new Error("재생목록에 대한 권한이 없습니다");
      }
      await addVideoToPlaylist(input.playlistId, input.videoId);
      return { success: true };
    }),
  removeVideo: protectedProcedure
    .input(z.object({ playlistId: z.number(), videoId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { removeVideoFromPlaylist, getUserPlaylists } = await import("../db");
      const userPlaylists = await getUserPlaylists(ctx.user.id);
      if (!userPlaylists.some((p) => p.id === input.playlistId)) {
        throw new Error("재생목록에 대한 권한이 없습니다");
      }
      await removeVideoFromPlaylist(input.playlistId, input.videoId);
      return { success: true };
    }),
  videoPlaylists: protectedProcedure
    .input(z.object({ videoId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { getPlaylistsForVideo } = await import("../db");
      return getPlaylistsForVideo(ctx.user.id, input.videoId);
    }),
});
