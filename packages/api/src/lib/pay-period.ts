import {
  addPeriodMonths,
  addPeriodWeeks,
  getPeriodStartFromAnchorWeeks,
  getPeriodStartMonthly,
  getPeriodStartWeekly,
  toUtc,
  toZoned,
} from "./time";

type PayCycle = "weekly" | "bi_weekly" | "four_weekly" | "monthly";

type JobPeriodConfig = {
  payCycle: PayCycle;
  anchorWeekday: number | null;
  anchorMonthday: number | null;
  anchorStartDateUtc: Date | null;
  timezone: string;
};

export function getPayPeriodForDate(
  job: JobPeriodConfig,
  atUtc: Date,
): { startUtc: Date; endUtc: Date } {
  const local = toZoned(atUtc, job.timezone);
  if (job.payCycle === "monthly") {
    if (!job.anchorMonthday) {
      throw new Error("Monthly pay cycle requires anchorMonthday");
    }
    const startLocal = getPeriodStartMonthly(local, job.anchorMonthday);
    const endLocal = addPeriodMonths(startLocal, 1);
    return {
      startUtc: toUtc(startLocal, job.timezone),
      endUtc: toUtc(endLocal, job.timezone),
    };
  }

  const weekStartsOn = (job.anchorWeekday ?? 1) as 0 | 1 | 2 | 3 | 4 | 5 | 6;
  if (job.payCycle === "weekly") {
    const startLocal = getPeriodStartWeekly(local, weekStartsOn);
    const endLocal = addPeriodWeeks(startLocal, 1);
    return {
      startUtc: toUtc(startLocal, job.timezone),
      endUtc: toUtc(endLocal, job.timezone),
    };
  }

  const periodWeeks = job.payCycle === "bi_weekly" ? 2 : 4;
  if (!job.anchorStartDateUtc) {
    const startLocal = getPeriodStartWeekly(local, weekStartsOn);
    const endLocal = addPeriodWeeks(startLocal, periodWeeks);
    return {
      startUtc: toUtc(startLocal, job.timezone),
      endUtc: toUtc(endLocal, job.timezone),
    };
  }

  const anchorLocal = toZoned(job.anchorStartDateUtc, job.timezone);
  const startLocal = getPeriodStartFromAnchorWeeks(
    local,
    anchorLocal,
    periodWeeks,
  );
  const endLocal = addPeriodWeeks(startLocal, periodWeeks);
  return {
    startUtc: toUtc(startLocal, job.timezone),
    endUtc: toUtc(endLocal, job.timezone),
  };
}

export function listPayPeriodsInRange(
  job: JobPeriodConfig,
  fromUtc: Date,
  toUtc: Date,
  limit: number,
): Array<{ startUtc: Date; endUtc: Date; payCycle: PayCycle }> {
  const periods: Array<{ startUtc: Date; endUtc: Date; payCycle: PayCycle }> =
    [];
  let cursor = getPayPeriodForDate(job, fromUtc).startUtc;
  while (cursor < toUtc && periods.length < limit) {
    const current = getPayPeriodForDate(job, cursor);
    periods.push({
      startUtc: current.startUtc,
      endUtc: current.endUtc,
      payCycle: job.payCycle,
    });
    cursor = current.endUtc;
  }
  return periods;
}
