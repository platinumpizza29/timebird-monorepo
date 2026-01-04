import { ORPCError } from "@orpc/server";
import prisma from "@timebird/db";

import { protectedProcedure } from "../index";
import {
  jobCreateInputSchema,
  jobListInputSchema,
  jobListOutputSchema,
  jobOutputSchema,
  jobUpdateInputSchema,
} from "../schemas/timebird";

function toJobOutput(job: {
  id: string;
  name: string;
  hourlyRateMinor: number;
  currency: string;
  contractedMinutesPerWeek: number | null;
  payCycle: string;
  anchorWeekday: number | null;
  anchorMonthday: number | null;
  anchorStartDateUtc: Date | null;
  standardBreakMinutes: number | null;
  standardBreakPaid: boolean;
  roundingMinutes: number | null;
  roundingMode: string | null;
  overtimeDailyThresholdMinutes: number | null;
  overtimeWeeklyThresholdMinutes: number | null;
  overtimeMultiplierBps: number | null;
  timezone: string;
}) {
  return {
    jobId: job.id,
    name: job.name,
    hourlyRate: {
      amount: job.hourlyRateMinor,
      currency: job.currency,
    },
    contractedMinutesPerWeek: job.contractedMinutesPerWeek,
    payCycle: job.payCycle,
    payPeriodAnchor: {
      weekday: job.anchorWeekday ?? undefined,
      monthday: job.anchorMonthday ?? undefined,
      startDateUtc: job.anchorStartDateUtc?.toISOString(),
    },
    standardBreak:
      job.standardBreakMinutes !== null
        ? {
            minutes: job.standardBreakMinutes,
            paid: job.standardBreakPaid,
          }
        : null,
    rounding:
      job.roundingMinutes !== null && job.roundingMode
        ? {
            minutes: job.roundingMinutes,
            mode: job.roundingMode,
          }
        : null,
    overtimeRule:
      job.overtimeDailyThresholdMinutes !== null ||
      job.overtimeWeeklyThresholdMinutes !== null ||
      job.overtimeMultiplierBps !== null
        ? {
            dailyThresholdMinutes: job.overtimeDailyThresholdMinutes ?? undefined,
            weeklyThresholdMinutes: job.overtimeWeeklyThresholdMinutes ?? undefined,
            multiplier:
              job.overtimeMultiplierBps !== null
                ? job.overtimeMultiplierBps / 10000
                : undefined,
          }
        : null,
    timezone: job.timezone,
  };
}

export const jobRouter = {
  create: protectedProcedure
    .input(jobCreateInputSchema)
    .output(jobOutputSchema)
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      const overtimeMultiplierBps = input.overtimeRule
        ? Math.round((input.overtimeRule.multiplier ?? 1.5) * 10000)
        : null;
      const job = await prisma.job.create({
        data: {
          userId,
          name: input.name,
          currency: input.hourlyRate.currency ?? "GBP",
          hourlyRateMinor: input.hourlyRate.amount,
          contractedMinutesPerWeek: input.contractedMinutesPerWeek ?? null,
          payCycle: input.payCycle,
          anchorWeekday: input.payPeriodAnchor.weekday ?? null,
          anchorMonthday: input.payPeriodAnchor.monthday ?? null,
          anchorStartDateUtc: input.payPeriodAnchor.startDateUtc
            ? new Date(input.payPeriodAnchor.startDateUtc)
            : null,
          timezone: input.timezone,
          standardBreakMinutes: input.standardBreak?.minutes ?? null,
          standardBreakPaid: input.standardBreak?.paid ?? false,
          roundingMinutes: input.rounding?.minutes ?? null,
          roundingMode: input.rounding?.mode ?? null,
          overtimeDailyThresholdMinutes:
            input.overtimeRule?.dailyThresholdMinutes ?? null,
          overtimeWeeklyThresholdMinutes:
            input.overtimeRule?.weeklyThresholdMinutes ?? null,
          overtimeMultiplierBps,
        },
      });
      return toJobOutput(job);
    }),
  update: protectedProcedure
    .input(jobUpdateInputSchema)
    .output(jobOutputSchema)
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      const job = await prisma.job.findFirst({
        where: { id: input.jobId, userId },
      });
      if (!job) {
        throw new ORPCError("NOT_FOUND");
      }

      const data: Record<string, unknown> = {};
      if (input.patch.name !== undefined) data.name = input.patch.name;
      if (input.patch.hourlyRate) {
        data.hourlyRateMinor = input.patch.hourlyRate.amount;
        data.currency = input.patch.hourlyRate.currency ?? job.currency;
      }
      if (input.patch.contractedMinutesPerWeek !== undefined) {
        data.contractedMinutesPerWeek = input.patch.contractedMinutesPerWeek;
      }
      if (input.patch.payCycle !== undefined) data.payCycle = input.patch.payCycle;
      if (input.patch.payPeriodAnchor) {
        data.anchorWeekday = input.patch.payPeriodAnchor.weekday ?? null;
        data.anchorMonthday = input.patch.payPeriodAnchor.monthday ?? null;
        data.anchorStartDateUtc = input.patch.payPeriodAnchor.startDateUtc
          ? new Date(input.patch.payPeriodAnchor.startDateUtc)
          : null;
      }
      if (input.patch.standardBreak !== undefined) {
        data.standardBreakMinutes = input.patch.standardBreak?.minutes ?? null;
        data.standardBreakPaid = input.patch.standardBreak?.paid ?? false;
      }
      if (input.patch.rounding !== undefined) {
        data.roundingMinutes = input.patch.rounding?.minutes ?? null;
        data.roundingMode = input.patch.rounding?.mode ?? null;
      }
      if (input.patch.overtimeRule !== undefined) {
        data.overtimeDailyThresholdMinutes =
          input.patch.overtimeRule?.dailyThresholdMinutes ?? null;
        data.overtimeWeeklyThresholdMinutes =
          input.patch.overtimeRule?.weeklyThresholdMinutes ?? null;
        data.overtimeMultiplierBps = input.patch.overtimeRule
          ? Math.round((input.patch.overtimeRule.multiplier ?? 1.5) * 10000)
          : null;
      }
      if (input.patch.timezone !== undefined) data.timezone = input.patch.timezone;

      const updated = await prisma.job.update({
        where: { id: job.id },
        data,
      });
      return toJobOutput(updated);
    }),
  get: protectedProcedure
    .input(
      jobOutputSchema.pick({
        jobId: true,
      }),
    )
    .output(jobOutputSchema)
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      const job = await prisma.job.findFirst({
        where: { id: input.jobId, userId },
      });
      if (!job) {
        throw new ORPCError("NOT_FOUND");
      }
      return toJobOutput(job);
    }),
  list: protectedProcedure
    .input(jobListInputSchema)
    .output(jobListOutputSchema)
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      const jobs = await prisma.job.findMany({
        where: {
          userId,
          ...(input.activeOnly ? { active: true } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      });
      const items = jobs.slice(0, input.limit).map((job) => ({
        jobId: job.id,
        name: job.name,
        hourlyRate: {
          amount: job.hourlyRateMinor,
          currency: job.currency,
        },
        payCycle: job.payCycle,
      }));
      const nextCursor =
        jobs.length > input.limit ? jobs[input.limit]?.id ?? null : null;
      return {
        items,
        nextCursor,
      };
    }),
};
