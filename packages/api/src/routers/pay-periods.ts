import { ORPCError } from "@orpc/server";
import prisma from "@timebird/db";

import { getPayPeriodForDate, listPayPeriodsInRange } from "../lib/pay-period";
import { protectedProcedure } from "../index";
import {
  payPeriodInputSchema,
  payPeriodListInputSchema,
  payPeriodListOutputSchema,
  payPeriodOutputSchema,
} from "../schemas/timebird";

export const payPeriodRouter = {
  current: protectedProcedure
    .input(payPeriodInputSchema)
    .output(payPeriodOutputSchema)
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      const job = await prisma.job.findFirst({
        where: { id: input.jobId, userId },
      });
      if (!job) {
        throw new ORPCError("NOT_FOUND");
      }
      const atUtc = input.atUtc ? new Date(input.atUtc) : new Date();
      const { startUtc, endUtc } = getPayPeriodForDate(
        {
          payCycle: job.payCycle,
          anchorWeekday: job.anchorWeekday,
          anchorMonthday: job.anchorMonthday,
          anchorStartDateUtc: job.anchorStartDateUtc,
          timezone: job.timezone,
        },
        atUtc,
      );
      return {
        jobId: job.id,
        periodStartUtc: startUtc.toISOString(),
        periodEndUtc: endUtc.toISOString(),
        payCycle: job.payCycle,
      };
    }),
  list: protectedProcedure
    .input(payPeriodListInputSchema)
    .output(payPeriodListOutputSchema)
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      const job = await prisma.job.findFirst({
        where: { id: input.jobId, userId },
      });
      if (!job) {
        throw new ORPCError("NOT_FOUND");
      }
      const fromUtc = input.fromUtc ? new Date(input.fromUtc) : new Date();
      const toUtc = input.toUtc
        ? new Date(input.toUtc)
        : new Date(fromUtc.getTime() + 1000 * 60 * 60 * 24 * 365);
      const periods = listPayPeriodsInRange(
        {
          payCycle: job.payCycle,
          anchorWeekday: job.anchorWeekday,
          anchorMonthday: job.anchorMonthday,
          anchorStartDateUtc: job.anchorStartDateUtc,
          timezone: job.timezone,
        },
        fromUtc,
        toUtc,
        input.limit,
      );
      return {
        items: periods.map((period) => ({
          periodStartUtc: period.startUtc.toISOString(),
          periodEndUtc: period.endUtc.toISOString(),
          payCycle: period.payCycle,
        })),
        nextCursor:
          periods.length === input.limit
            ? periods[periods.length - 1]?.endUtc.toISOString() ?? null
            : null,
      };
    }),
};
