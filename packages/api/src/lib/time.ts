import {
  addMonths,
  addWeeks,
  differenceInCalendarDays,
  endOfMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

export function toZoned(dateUtc: Date, timeZone: string) {
  return toZonedTime(dateUtc, timeZone);
}

export function toUtc(dateLocal: Date, timeZone: string) {
  return fromZonedTime(dateLocal, timeZone);
}

export function clampMonthday(year: number, monthIndex: number, day: number) {
  const last = endOfMonth(new Date(year, monthIndex, 1)).getDate();
  return Math.min(day, last);
}

export function getPeriodStartWeekly(
  dateLocal: Date,
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6,
) {
  return startOfDay(startOfWeek(dateLocal, { weekStartsOn }));
}

export function getPeriodStartMonthly(dateLocal: Date, anchorMonthday: number) {
  const year = dateLocal.getFullYear();
  const monthIndex = dateLocal.getMonth();
  const clampedDay = clampMonthday(year, monthIndex, anchorMonthday);
  const thisAnchor = new Date(year, monthIndex, clampedDay);
  if (dateLocal < thisAnchor) {
    const previousMonth = addMonths(startOfMonth(dateLocal), -1);
    const prevYear = previousMonth.getFullYear();
    const prevMonthIndex = previousMonth.getMonth();
    const prevDay = clampMonthday(prevYear, prevMonthIndex, anchorMonthday);
    return startOfDay(new Date(prevYear, prevMonthIndex, prevDay));
  }
  return startOfDay(thisAnchor);
}

export function getPeriodStartFromAnchorWeeks(
  dateLocal: Date,
  anchorLocal: Date,
  periodWeeks: number,
) {
  const anchorStart = startOfDay(anchorLocal);
  const targetStart = startOfDay(dateLocal);
  const diffDays = differenceInCalendarDays(targetStart, anchorStart);
  const diffWeeks = Math.floor(diffDays / 7);
  const periodIndex = Math.floor(diffWeeks / periodWeeks);
  return addWeeks(anchorStart, periodIndex * periodWeeks);
}

export function addPeriodWeeks(startLocal: Date, weeks: number) {
  return addWeeks(startLocal, weeks);
}

export function addPeriodMonths(startLocal: Date, months: number) {
  return addMonths(startLocal, months);
}
