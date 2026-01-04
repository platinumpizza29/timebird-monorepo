import { ORPCError } from "@orpc/server";
import prisma from "@timebird/db";
import {
  addDays,
  addMonths,
  addWeeks,
  differenceInCalendarDays,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

import {
  calculateOvertimeMinutes,
  projectMinutesToPeriod,
  toMinorEarnings,
} from "../lib/calculations";
import { protectedProcedure } from "../index";
import {
  summaryCompareInputSchema,
  summaryCompareOutputSchema,
  summaryMonthInputSchema,
  summaryMonthOutputSchema,
  summaryPayPeriodInputSchema,
  summaryPayPeriodOutputSchema,
  summaryRangeInputSchema,
  summaryRangeOutputSchema,
} from "../schemas/timebird";

function clipShiftToRange(
  shift: { startUtc: Date; endUtc: Date; payableMinutes: number },
  rangeStart: Date,
  rangeEnd: Date,
) {
  const overlapStart = shift.startUtc > rangeStart ? shift.startUtc : rangeStart;
  const overlapEnd = shift.endUtc < rangeEnd ? shift.endUtc : rangeEnd;
  if (overlapEnd <= overlapStart) {
    return null;
  }
  const shiftDuration = Math.max(
    0,
    Math.floor((shift.endUtc.getTime() - shift.startUtc.getTime()) / 60000),
  );
  const overlapDuration = Math.max(
    0,
    Math.floor((overlapEnd.getTime() - overlapStart.getTime()) / 60000),
  );
  const ratio = shiftDuration > 0 ? overlapDuration / shiftDuration : 0;
  return {
    startUtc: overlapStart,
    endUtc: overlapEnd,
    payableMinutes: Math.round(shift.payableMinutes * ratio),
  };
}

function buildBuckets(
  fromUtc: Date,
  toUtc: Date,
  timeZone: string,
  bucket: "day" | "week" | "month",
) {
  const buckets: Array<{ startUtc: Date; endUtc: Date }> = [];
  const fromLocal = toZonedTime(fromUtc, timeZone);
  const toLocal = toZonedTime(toUtc, timeZone);

  let cursor =
    bucket === "day"
      ? startOfDay(fromLocal)
      : bucket === "week"
        ? startOfWeek(fromLocal, { weekStartsOn: 1 })
        : startOfMonth(fromLocal);

  while (cursor < toLocal) {
    const next =
      bucket === "day"
        ? addDays(cursor, 1)
        : bucket === "week"
          ? addWeeks(cursor, 1)
          : addMonths(cursor, 1);
    buckets.push({
      startUtc: fromZonedTime(cursor, timeZone),
      endUtc: fromZonedTime(next, timeZone),
    });
    cursor = next;
  }
  return buckets;
}

export const summaryRouter = {
  payPeriod: protectedProcedure
    .input(summaryPayPeriodInputSchema)
    .output(summaryPayPeriodOutputSchema)
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      const job = await prisma.job.findFirst({
        where: { id: input.jobId, userId },
      });
      if (!job) {
        throw new ORPCError("NOT_FOUND");
      }
      const periodStartUtc = new Date(input.periodStartUtc);
      const periodEndUtc = new Date(input.periodEndUtc);
      const shifts = await prisma.shift.findMany({
        where: {
          userId,
          jobId: job.id,
          startUtc: { lt: periodEndUtc },
          endUtc: { gt: periodStartUtc },
        },
      });
      const clipped = shifts
        .map((shift) =>
          clipShiftToRange(
            {
              startUtc: shift.startUtc,
              endUtc: shift.endUtc,
              payableMinutes: shift.payableMinutes,
            },
            periodStartUtc,
            periodEndUtc,
          ),
        )
        .filter((shift): shift is NonNullable<typeof shift> => Boolean(shift));
      const totalMinutes = clipped.reduce(
        (total, shift) => total + shift.payableMinutes,
        0,
      );
      const hasOvertimeConfig =
        job.overtimeDailyThresholdMinutes !== null ||
        job.overtimeWeeklyThresholdMinutes !== null ||
        job.overtimeMultiplierBps !== null;
      const dailyThresholdMinutes = hasOvertimeConfig
        ? job.overtimeDailyThresholdMinutes
        : null;
      const weeklyThresholdMinutes = hasOvertimeConfig
        ? job.overtimeWeeklyThresholdMinutes ??
          job.contractedMinutesPerWeek ??
          null
        : null;
      const overtimeMinutes = calculateOvertimeMinutes(
        clipped,
        job.timezone,
        dailyThresholdMinutes,
        weeklyThresholdMinutes,
      );
      const grossMinor = toMinorEarnings(
        totalMinutes,
        overtimeMinutes,
        job.hourlyRateMinor,
        job.overtimeMultiplierBps,
      );

      const startLocal = toZonedTime(periodStartUtc, job.timezone);
      const endLocal = toZonedTime(periodEndUtc, job.timezone);
      const todayLocal = toZonedTime(new Date(), job.timezone);
      const elapsedDays = Math.max(
        0,
        Math.min(
          differenceInCalendarDays(todayLocal, startLocal),
          differenceInCalendarDays(endLocal, startLocal),
        ),
      );
      const remainingDays = Math.max(
        0,
        differenceInCalendarDays(endLocal, todayLocal),
      );
      const projectedMinutes = projectMinutesToPeriod(
        totalMinutes,
        elapsedDays,
        remainingDays,
      );
      const projectedMinor = toMinorEarnings(
        projectedMinutes,
        overtimeMinutes,
        job.hourlyRateMinor,
        job.overtimeMultiplierBps,
      );

      return {
        totalMinutes,
        overtimeMinutes,
        grossEarnings: {
          amount: grossMinor,
          currency: job.currency,
        },
        projectedEarnings: {
          amount: projectedMinor,
          currency: job.currency,
        },
        contractedMinutesPerWeek: job.contractedMinutesPerWeek,
      };
    }),
  month: protectedProcedure
    .input(summaryMonthInputSchema)
    .output(summaryMonthOutputSchema)
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      const job = await prisma.job.findFirst({
        where: { id: input.jobId, userId },
      });
      if (!job) {
        throw new ORPCError("NOT_FOUND");
      }
      const [yearText, monthText] = input.month.split("-");
      const year = Number(yearText);
      const monthIndex = Number(monthText) - 1;
      const startLocal = new Date(year, monthIndex, 1);
      const endLocal = addMonths(startLocal, 1);
      const startUtc = fromZonedTime(startLocal, job.timezone);
      const endUtc = fromZonedTime(endLocal, job.timezone);

      const shifts = await prisma.shift.findMany({
        where: {
          userId,
          jobId: job.id,
          startUtc: { lt: endUtc },
          endUtc: { gt: startUtc },
        },
      });
      const clipped = shifts
        .map((shift) =>
          clipShiftToRange(
            {
              startUtc: shift.startUtc,
              endUtc: shift.endUtc,
              payableMinutes: shift.payableMinutes,
            },
            startUtc,
            endUtc,
          ),
        )
        .filter((shift): shift is NonNullable<typeof shift> => Boolean(shift));
      const totalMinutes = clipped.reduce(
        (total, shift) => total + shift.payableMinutes,
        0,
      );
      const hasOvertimeConfig =
        job.overtimeDailyThresholdMinutes !== null ||
        job.overtimeWeeklyThresholdMinutes !== null ||
        job.overtimeMultiplierBps !== null;
      const dailyThresholdMinutes = hasOvertimeConfig
        ? job.overtimeDailyThresholdMinutes
        : null;
      const weeklyThresholdMinutes = hasOvertimeConfig
        ? job.overtimeWeeklyThresholdMinutes ??
          job.contractedMinutesPerWeek ??
          null
        : null;
      const overtimeMinutes = calculateOvertimeMinutes(
        clipped,
        job.timezone,
        dailyThresholdMinutes,
        weeklyThresholdMinutes,
      );
      const grossMinor = toMinorEarnings(
        totalMinutes,
        overtimeMinutes,
        job.hourlyRateMinor,
        job.overtimeMultiplierBps,
      );

      return {
        month: input.month,
        totalMinutes,
        overtimeMinutes,
        grossEarnings: {
          amount: grossMinor,
          currency: job.currency,
        },
      };
    }),
  range: protectedProcedure
    .input(summaryRangeInputSchema)
    .output(summaryRangeOutputSchema)
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      const job = await prisma.job.findFirst({
        where: { id: input.jobId, userId },
      });
      if (!job) {
        throw new ORPCError("NOT_FOUND");
      }
      const fromUtc = new Date(input.fromUtc);
      const toUtc = new Date(input.toUtc);
      const shifts = await prisma.shift.findMany({
        where: {
          userId,
          jobId: job.id,
          startUtc: { lt: toUtc },
          endUtc: { gt: fromUtc },
        },
      });
      const buckets = buildBuckets(fromUtc, toUtc, job.timezone, input.bucket);
      const results = buckets.map((bucket) => {
        const clipped = shifts
          .map((shift) =>
            clipShiftToRange(
              {
                startUtc: shift.startUtc,
                endUtc: shift.endUtc,
                payableMinutes: shift.payableMinutes,
              },
              bucket.startUtc,
              bucket.endUtc,
            ),
          )
          .filter((shift): shift is NonNullable<typeof shift> => Boolean(shift));
        const totalMinutes = clipped.reduce(
          (total, shift) => total + shift.payableMinutes,
          0,
        );
        const hasOvertimeConfig =
          job.overtimeDailyThresholdMinutes !== null ||
          job.overtimeWeeklyThresholdMinutes !== null ||
          job.overtimeMultiplierBps !== null;
        const dailyThresholdMinutes = hasOvertimeConfig
          ? job.overtimeDailyThresholdMinutes
          : null;
        const weeklyThresholdMinutes = hasOvertimeConfig
          ? job.overtimeWeeklyThresholdMinutes ??
            job.contractedMinutesPerWeek ??
            null
          : null;
        const overtimeMinutes = calculateOvertimeMinutes(
          clipped,
          job.timezone,
          dailyThresholdMinutes,
          weeklyThresholdMinutes,
        );
        const grossMinor = toMinorEarnings(
          totalMinutes,
          overtimeMinutes,
          job.hourlyRateMinor,
          job.overtimeMultiplierBps,
        );
        return {
          startUtc: bucket.startUtc.toISOString(),
          endUtc: bucket.endUtc.toISOString(),
          totalMinutes,
          overtimeMinutes,
          grossEarnings: {
            amount: grossMinor,
            currency: job.currency,
          },
        };
      });

      return { buckets: results };
    }),
  compareContracted: protectedProcedure
    .input(summaryCompareInputSchema)
    .output(summaryCompareOutputSchema)
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      const job = await prisma.job.findFirst({
        where: { id: input.jobId, userId },
      });
      if (!job) {
        throw new ORPCError("NOT_FOUND");
      }
      const fromUtc = new Date(input.fromUtc);
      const toUtc = new Date(input.toUtc);
      const shifts = await prisma.shift.findMany({
        where: {
          userId,
          jobId: job.id,
          startUtc: { lt: toUtc },
          endUtc: { gt: fromUtc },
        },
      });
      const totalMinutes = shifts.reduce(
        (total, shift) => total + shift.payableMinutes,
        0,
      );
      const contractedMinutes = job.contractedMinutesPerWeek ?? null;
      const deltaMinutes =
        contractedMinutes !== null ? totalMinutes - contractedMinutes : null;
      return {
        contractedMinutes,
        actualMinutes: totalMinutes,
        deltaMinutes,
      };
    }),
};
