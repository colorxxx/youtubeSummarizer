import { protectedProcedure, router } from "../_core/trpc";
import { getRecentTasks } from "../backgroundTasks";

export const backgroundTasksRouter = router({
  list: protectedProcedure.query(({ ctx }) => {
    return getRecentTasks(ctx.user.id, 10);
  }),
});
