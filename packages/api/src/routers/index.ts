import type { RouterClient } from "@orpc/server";

import { protectedProcedure, publicProcedure } from "../index";
import { exportRouter } from "./exports";
import { jobRouter } from "./jobs";
import { payPeriodRouter } from "./pay-periods";
import { shiftRouter } from "./shifts";
import { summaryRouter } from "./summaries";
import { userSettingsRouter } from "./user-settings";

export const appRouter = {
  healthCheck: publicProcedure.handler(() => {
    return "OK";
  }),
  privateData: protectedProcedure.handler(({ context }) => {
    return {
      message: "This is private",
      user: context.session?.user,
    };
  }),
  job: jobRouter,
  shift: shiftRouter,
  payPeriod: payPeriodRouter,
  summary: summaryRouter,
  export: exportRouter,
  userSettings: userSettingsRouter,
};

export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
