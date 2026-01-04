import prisma from "@timebird/db";

import { protectedProcedure } from "../index";
import { userSettingsOutputSchema, userSettingsUpdateInputSchema } from "../schemas/timebird";

function toSettingsOutput(settings: {
  currency: string;
  hourlyRateMinor: number | null;
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
    currency: settings.currency,
    hourlyRate:
      settings.hourlyRateMinor !== null
        ? { amount: settings.hourlyRateMinor, currency: settings.currency }
        : null,
    contractedMinutesPerWeek: settings.contractedMinutesPerWeek,
    payCycle: settings.payCycle,
    payPeriodAnchor: {
      weekday: settings.anchorWeekday ?? undefined,
      monthday: settings.anchorMonthday ?? undefined,
      startDateUtc: settings.anchorStartDateUtc?.toISOString(),
    },
    standardBreak:
      settings.standardBreakMinutes !== null
        ? {
            minutes: settings.standardBreakMinutes,
            paid: settings.standardBreakPaid,
          }
        : null,
    rounding:
      settings.roundingMinutes !== null && settings.roundingMode
        ? { minutes: settings.roundingMinutes, mode: settings.roundingMode }
        : null,
    overtimeRule:
      settings.overtimeDailyThresholdMinutes !== null ||
      settings.overtimeWeeklyThresholdMinutes !== null ||
      settings.overtimeMultiplierBps !== null
        ? {
            dailyThresholdMinutes:
              settings.overtimeDailyThresholdMinutes ?? undefined,
            weeklyThresholdMinutes:
              settings.overtimeWeeklyThresholdMinutes ?? undefined,
            multiplier:
              settings.overtimeMultiplierBps !== null
                ? settings.overtimeMultiplierBps / 10000
                : undefined,
          }
        : null,
    timezone: settings.timezone,
  };
}

const defaultSettings = {
  currency: "GBP",
  hourlyRateMinor: null,
  contractedMinutesPerWeek: null,
  payCycle: "weekly",
  anchorWeekday: 1,
  anchorMonthday: null,
  anchorStartDateUtc: null,
  standardBreakMinutes: null,
  standardBreakPaid: false,
  roundingMinutes: null,
  roundingMode: null,
  overtimeDailyThresholdMinutes: null,
  overtimeWeeklyThresholdMinutes: null,
  overtimeMultiplierBps: null,
  timezone: "Europe/London",
};

export const userSettingsRouter = {
  get: protectedProcedure
    .output(userSettingsOutputSchema)
    .handler(async ({ context }) => {
      const userId = context.session.user.id;
      const settings = await prisma.userSettings.findUnique({
        where: { userId },
      });
      if (!settings) {
        return toSettingsOutput(defaultSettings);
      }
      return toSettingsOutput(settings);
    }),
  update: protectedProcedure
    .input(userSettingsUpdateInputSchema)
    .output(userSettingsOutputSchema)
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      const overtimeMultiplierBps = input.patch.overtimeRule
        ? Math.round((input.patch.overtimeRule.multiplier ?? 1.5) * 10000)
        : undefined;
      const data: Record<string, unknown> = {};
      if (input.patch.currency !== undefined) data.currency = input.patch.currency;
      if (input.patch.hourlyRate !== undefined) {
        data.hourlyRateMinor = input.patch.hourlyRate?.amount ?? null;
        data.currency = input.patch.hourlyRate?.currency ?? input.patch.currency ?? "GBP";
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
        data.overtimeMultiplierBps = overtimeMultiplierBps ?? null;
      }
      if (input.patch.timezone !== undefined) data.timezone = input.patch.timezone;

      const updated = await prisma.userSettings.upsert({
        where: { userId },
        create: {
          userId,
          ...defaultSettings,
          ...data,
        },
        update: data,
      });
      return toSettingsOutput(updated);
    }),
};
