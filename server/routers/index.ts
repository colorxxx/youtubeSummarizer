import { router } from "../_core/trpc";
import { systemRouter } from "../_core/systemRouter";
import { authRouter } from "./auth";
import { subscriptionsRouter } from "./subscriptions";
import { dashboardRouter } from "./dashboard";
import { youtubeRouter } from "./youtube";
import { videosRouter } from "./videos";
import { summariesRouter, directSummaryRouter } from "./summaries";
import { chatRouter } from "./chat";
import { backgroundTasksRouter } from "./backgroundTasks";
import { settingsRouter } from "./settings";
import { bookmarksRouter } from "./bookmarks";
import { playlistsRouter } from "./playlists";

export const appRouter = router({
  system: systemRouter,
  auth: authRouter,
  subscriptions: subscriptionsRouter,
  dashboard: dashboardRouter,
  youtube: youtubeRouter,
  videos: videosRouter,
  summaries: summariesRouter,
  chat: chatRouter,
  directSummary: directSummaryRouter,
  backgroundTasks: backgroundTasksRouter,
  settings: settingsRouter,
  bookmarks: bookmarksRouter,
  playlists: playlistsRouter,
});

export type AppRouter = typeof appRouter;
