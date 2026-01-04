import { addDays, differenceInMinutes, format, startOfDay, startOfWeek } from "date-fns";
import { toZonedTime } from "date-fns-tz";

type BreakInput = { minutes: number; paid?: boolean };
type RoundingRule = { minutes: number; mode: "nearest" | "floor" | "ceil" };
type ShiftInput = {
  startUtc: Date;
  endUtc: Date;
  payableMinutes: number;
};

export function calculatePayableMinutes(
  startUtc: Date,
  endUtc: Date,
  breaks: BreakInput[],
  rounding?: RoundingRule | null,
) {
  const durationMinutes = Math.max(
    0,
    Math.floor((endUtc.getTime() - startUtc.getTime()) / 60000),
  );
  const unpaidBreakMinutes = breaks.reduce((total, item) => {
    return total + (item.paid ? 0 : item.minutes);
  }, 0);
  if (unpaidBreakMinutes > durationMinutes) {
    throw new Error("Break minutes exceed shift duration");
  }
  const rawMinutes = Math.max(0, durationMinutes - unpaidBreakMinutes);
  if (!rounding) {
    return rawMinutes;
  }
  return roundMinutes(rawMinutes, rounding);
}

export function roundMinutes(minutes: number, rule: RoundingRule) {
  const factor = rule.minutes;
  if (factor <= 0) {
    return minutes;
  }
  const quotient = minutes / factor;
  const rounded =
    rule.mode === "floor"
      ? Math.floor(quotient)
      : rule.mode === "ceil"
        ? Math.ceil(quotient)
        : Math.round(quotient);
  return Math.max(0, rounded * factor);
}

export function toMinorEarnings(
  totalMinutes: number,
  overtimeMinutes: number,
  hourlyRateMinor: number,
  overtimeMultiplierBps?: number | null,
) {
  const baseMinutes = Math.max(0, totalMinutes - overtimeMinutes);
  const baseMinor = Math.round((baseMinutes * hourlyRateMinor) / 60);
  if (!overtimeMinutes || !overtimeMultiplierBps) {
    return baseMinor;
  }
  const overtimeMinor = Math.round(
    (overtimeMinutes * hourlyRateMinor * overtimeMultiplierBps) / (60 * 10000),
  );
  return baseMinor + overtimeMinor;
}

export function splitShiftByLocalDay(
  shift: { startUtc: Date; endUtc: Date; payableMinutes: number },
  timeZone: string,
) {
  const segments: Array<{ dayKey: string; minutes: number; startLocal: Date }> =
    [];
  const startLocal = toZonedTime(shift.startUtc, timeZone);
  const endLocal = toZonedTime(shift.endUtc, timeZone);
  let cursor = startLocal;
  let remainingMinutes = shift.payableMinutes;
  while (cursor < endLocal && remainingMinutes > 0) {
    const dayStart = startOfDay(cursor);
    const nextDay = addDays(dayStart, 1);
    const segmentEnd = endLocal < nextDay ? endLocal : nextDay;
    const segmentMinutes = Math.min(
      remainingMinutes,
      Math.max(0, differenceInMinutes(segmentEnd, cursor)),
    );
    if (segmentMinutes > 0) {
      segments.push({
        dayKey: format(cursor, "yyyy-MM-dd"),
        minutes: segmentMinutes,
        startLocal: cursor,
      });
    }
    remainingMinutes -= segmentMinutes;
    cursor = segmentEnd;
  }
  return segments;
}

export function calculateOvertimeMinutes(
  shifts: ShiftInput[],
  timeZone: string,
  dailyThresholdMinutes?: number | null,
  weeklyThresholdMinutes?: number | null,
) {
  const dailyTotals = new Map<string, number>();
  const weeklyTotals = new Map<string, number>();
  for (const shift of shifts) {
    const segments = splitShiftByLocalDay(shift, timeZone);
    for (const segment of segments) {
      dailyTotals.set(
        segment.dayKey,
        (dailyTotals.get(segment.dayKey) ?? 0) + segment.minutes,
      );
      const weekKey = format(
        startOfWeek(segment.startLocal, { weekStartsOn: 1 }),
        "yyyy-MM-dd",
      );
      weeklyTotals.set(
        weekKey,
        (weeklyTotals.get(weekKey) ?? 0) + segment.minutes,
      );
    }
  }

  let dailyOvertime = 0;
  if (dailyThresholdMinutes !== undefined && dailyThresholdMinutes !== null) {
    for (const total of dailyTotals.values()) {
      dailyOvertime += Math.max(0, total - dailyThresholdMinutes);
    }
  }

  let weeklyOvertime = 0;
  if (weeklyThresholdMinutes !== undefined && weeklyThresholdMinutes !== null) {
    for (const total of weeklyTotals.values()) {
      weeklyOvertime += Math.max(0, total - weeklyThresholdMinutes);
    }
  }

  if (dailyOvertime && weeklyOvertime) {
    return Math.max(dailyOvertime, weeklyOvertime);
  }
  return dailyOvertime || weeklyOvertime || 0;
}

export function projectMinutesToPeriod(
  currentMinutes: number,
  elapsedDays: number,
  remainingDays: number,
) {
  if (elapsedDays <= 0 || remainingDays <= 0) {
    return currentMinutes;
  }
  const averagePerDay = currentMinutes / elapsedDays;
  return Math.round(currentMinutes + averagePerDay * remainingDays);
}
