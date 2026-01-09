import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/calendar")({
  component: RouteComponent,
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data) {
      redirect({
        to: "/login",
        throw: true,
      });
    }
    return { session };
  },
});

function toDateKey(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function getWeekStart(date: Date) {
  const start = new Date(date);
  const offset = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - offset);
  start.setHours(0, 0, 0, 0);
  return start;
}

// Calendar page: month/week grid with a day timeline.
function RouteComponent() {
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [calendarView, setCalendarView] = useState<"month" | "week">("month");
  const [calendarFocus, setCalendarFocus] = useState(() => new Date());
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);

  const jobListQuery = useQuery(
    orpc.job.list.queryOptions({
      input: { limit: 20, activeOnly: true },
    }),
  );

  useEffect(() => {
    if (!selectedJobId && jobListQuery.data?.items?.length) {
      setSelectedJobId(jobListQuery.data.items[0].jobId);
    }
  }, [jobListQuery.data?.items, selectedJobId]);

  // Range used to fetch shifts for the calendar grid (month or week).
  const calendarRange = useMemo(() => {
    if (!selectedJobId) return null;
    if (calendarView === "week") {
      const weekStart = getWeekStart(calendarFocus);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
      return {
        jobId: selectedJobId,
        fromUtc: weekStart.toISOString(),
        toUtc: weekEnd.toISOString(),
        limit: 100,
        sort: "startAsc" as const,
      };
    }
    const monthStart = new Date(
      calendarFocus.getFullYear(),
      calendarFocus.getMonth(),
      1,
    );
    const monthEnd = new Date(
      calendarFocus.getFullYear(),
      calendarFocus.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );
    return {
      jobId: selectedJobId,
      fromUtc: monthStart.toISOString(),
      toUtc: monthEnd.toISOString(),
      limit: 100,
      sort: "startAsc" as const,
    };
  }, [calendarFocus, calendarView, selectedJobId]);

  const calendarShiftQuery = useQuery(
    orpc.shift.list.queryOptions({
      input: calendarRange ?? { limit: 1, sort: "startAsc" },
      enabled: Boolean(calendarRange),
    }),
  );

  const calendarItems = calendarShiftQuery.data?.items ?? [];

  // Bucket shifts by local date for fast day rendering.
  const shiftsByDay = useMemo(() => {
    const map = new Map<string, typeof calendarItems>();
    for (const shift of calendarItems) {
      const start = new Date(shift.startUtc);
      const key = toDateKey(start);
      const list = map.get(key) ?? [];
      list.push(shift);
      map.set(key, list);
    }
    return map;
  }, [calendarItems]);

  // Build the calendar grid: week view is 7 days, month view is a padded 6-week grid.
  const calendarDays = useMemo(() => {
    if (calendarView === "week") {
      const start = getWeekStart(calendarFocus);
      return Array.from({ length: 7 }, (_, index) => {
        const day = new Date(start);
        day.setDate(start.getDate() + index);
        return day;
      });
    }
    const start = new Date(calendarFocus.getFullYear(), calendarFocus.getMonth(), 1);
    const end = new Date(calendarFocus.getFullYear(), calendarFocus.getMonth() + 1, 0);
    const startOffset = (start.getDay() + 6) % 7;
    const endOffset = (end.getDay() + 6) % 7;
    const gridStart = new Date(start);
    gridStart.setDate(start.getDate() - startOffset);
    const gridEnd = new Date(end);
    gridEnd.setDate(end.getDate() + (6 - endOffset));
    const days: Date[] = [];
    const cursor = new Date(gridStart);
    while (cursor <= gridEnd) {
      days.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return days;
  }, [calendarFocus, calendarView]);

  const selectedDayShifts = useMemo(() => {
    if (!selectedDayKey) return [];
    const list = shiftsByDay.get(selectedDayKey) ?? [];
    return [...list].sort(
      (a, b) => new Date(a.startUtc).getTime() - new Date(b.startUtc).getTime(),
    );
  }, [selectedDayKey, shiftsByDay]);

  // Timeline helpers for the day view (24 hours, 40px per hour).
  const timelineHours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);
  const timelineShifts = useMemo(() => {
    if (!selectedDayKey) return [];
    const base = new Date(`${selectedDayKey}T00:00:00`);
    return selectedDayShifts.map((shift) => {
      const start = new Date(shift.startUtc);
      const end = new Date(shift.endUtc);
      const startMinutes = Math.max(
        0,
        Math.floor((start.getTime() - base.getTime()) / 60000),
      );
      const endMinutes = Math.min(
        24 * 60,
        Math.ceil((end.getTime() - base.getTime()) / 60000),
      );
      return {
        ...shift,
        startMinutes,
        endMinutes: Math.max(endMinutes, startMinutes + 15),
      };
    });
  }, [selectedDayKey, selectedDayShifts]);

  return (
    <div className="min-h-svh bg-background">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6">
        <section className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Shift Calendar</h1>
            <p className="text-sm text-muted-foreground">
              Review past and upcoming shifts by day.
            </p>
          </div>
          <select
            value={selectedJobId}
            onChange={(event) => setSelectedJobId(event.target.value)}
            className="border-border bg-background text-foreground h-8 rounded-none border px-2 text-xs"
          >
            <option value="" disabled>
              {jobListQuery.isLoading ? "Loading jobs..." : "Select job"}
            </option>
            {jobListQuery.data?.items.map((job) => (
              <option key={job.jobId} value={job.jobId}>
                {job.name}
              </option>
            ))}
          </select>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <Card>
            <CardHeader className="border-b">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>Calendar</CardTitle>
                  <CardDescription>Month or week view with shift previews.</CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1 rounded-none border border-border p-1">
                    <Button
                      size="sm"
                      variant={calendarView === "month" ? "default" : "ghost"}
                      onClick={() => setCalendarView("month")}
                    >
                      Month
                    </Button>
                    <Button
                      size="sm"
                      variant={calendarView === "week" ? "default" : "ghost"}
                      onClick={() => setCalendarView("week")}
                    >
                      Week
                    </Button>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const next = new Date(calendarFocus);
                      next.setDate(
                        calendarView === "week" ? calendarFocus.getDate() - 7 : 1,
                      );
                      if (calendarView === "month") {
                        next.setMonth(calendarFocus.getMonth() - 1);
                      }
                      setCalendarFocus(next);
                    }}
                  >
                    Prev
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const now = new Date();
                      setCalendarFocus(now);
                      setSelectedDayKey(toDateKey(now));
                    }}
                  >
                    Today
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const next = new Date(calendarFocus);
                      next.setDate(
                        calendarView === "week" ? calendarFocus.getDate() + 7 : 1,
                      );
                      if (calendarView === "month") {
                        next.setMonth(calendarFocus.getMonth() + 1);
                      }
                      setCalendarFocus(next);
                    }}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">
                  {calendarView === "month"
                    ? calendarFocus.toLocaleDateString("en-GB", {
                        month: "long",
                        year: "numeric",
                      })
                    : `${getWeekStart(calendarFocus).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                      })} - ${new Date(
                        getWeekStart(calendarFocus).getFullYear(),
                        getWeekStart(calendarFocus).getMonth(),
                        getWeekStart(calendarFocus).getDate() + 6,
                      ).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                      })}`}
                </span>
                <span className="text-xs text-muted-foreground">
                  {calendarShiftQuery.isLoading
                    ? "Loading shifts..."
                    : calendarRange
                      ? `${calendarShiftQuery.data?.items.length ?? 0} shifts`
                      : "Select a job"}
                </span>
              </div>
              <div className="grid grid-cols-7 text-[11px] text-muted-foreground">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                  <div key={day} className="px-2 py-1">
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-px rounded-none border bg-border">
                {calendarDays.map((day) => {
                  const key = toDateKey(day);
                  const shifts = shiftsByDay.get(key) ?? [];
                  const isOutsideMonth = day.getMonth() !== calendarFocus.getMonth();
                  const isToday = toDateKey(day) === toDateKey(new Date());
                  const isSelected = selectedDayKey === key;
                  const visibleShifts = shifts.slice(0, 3);
                  const remaining = shifts.length - visibleShifts.length;
                  return (
                    <button
                      type="button"
                      key={key}
                      onClick={() => {
                        setSelectedDayKey(key);
                        setCalendarFocus(day);
                      }}
                      className={`min-h-24 bg-background p-2 text-left transition ${
                        isOutsideMonth ? "bg-muted/30 text-muted-foreground" : ""
                      } ${isSelected ? "ring-2 ring-primary/70" : "hover:bg-muted/40"}`}
                    >
                      {/* Day cell header + shift preview chips */}
                      <div className="flex items-center justify-between">
                        <span
                          className={
                            isToday ? "text-xs font-semibold text-primary" : "text-xs"
                          }
                        >
                          {day.getDate()}
                        </span>
                        {isToday && (
                          <span className="text-[10px] text-primary">Today</span>
                        )}
                      </div>
                      <div className="mt-2 space-y-1">
                        {visibleShifts.map((shift) => {
                          const start = new Date(shift.startUtc);
                          const end = new Date(shift.endUtc);
                          return (
                            <div
                              key={shift.shiftId}
                              className="rounded-none border border-border/60 bg-secondary/20 px-1 py-0.5 text-[10px]"
                            >
                              <span className="font-medium">
                                {start.toLocaleTimeString("en-GB", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>{" "}
                              -{" "}
                              {end.toLocaleTimeString("en-GB", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}{" "}
                              {shift.siteTag ?? shift.roleTag ?? "Shift"}
                            </div>
                          );
                        })}
                        {remaining > 0 && (
                          <div className="text-[10px] text-muted-foreground">
                            +{remaining} more
                          </div>
                        )}
                        {!shifts.length && !isOutsideMonth && (
                          <div className="text-[10px] text-muted-foreground">—</div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6">
            {selectedDayKey && (
              <Card>
                <CardHeader className="border-b">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <CardTitle>Day Timeline</CardTitle>
                      <CardDescription>
                        {new Date(`${selectedDayKey}T00:00:00`).toLocaleDateString(
                          "en-GB",
                          {
                            weekday: "long",
                            day: "2-digit",
                            month: "long",
                          },
                        )}
                      </CardDescription>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedDayKey(null)}
                    >
                      Clear
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {/* Time-blocking view: 24h grid with positioned shift blocks */}
                  <div className="grid grid-cols-[64px_1fr] border-t">
                    <div className="border-r bg-muted/20">
                      {timelineHours.map((hour) => (
                        <div
                          key={hour}
                          className="flex h-10 items-start justify-end pr-2 text-[10px] text-muted-foreground"
                        >
                          {String(hour).padStart(2, "0")}:00
                        </div>
                      ))}
                    </div>
                    <div className="relative h-[960px] bg-background">
                      {/* Hour grid lines */}
                      {timelineHours.map((hour) => (
                        <div
                          key={hour}
                          className="h-10 border-b border-dashed border-border/60"
                        />
                      ))}
                      {/* Shift blocks positioned by minutes from midnight */}
                      {timelineShifts.map((shift) => {
                        const top = shift.startMinutes * (40 / 60);
                        const height = Math.max(
                          16,
                          (shift.endMinutes - shift.startMinutes) * (40 / 60),
                        );
                        const start = new Date(shift.startUtc);
                        const end = new Date(shift.endUtc);
                        return (
                          <div
                            key={shift.shiftId}
                            className="absolute left-3 right-3 rounded-none border border-primary/60 bg-primary/15 px-2 py-1 text-[11px]"
                            style={{ top, height }}
                          >
                            <div className="font-medium">
                              {start.toLocaleTimeString("en-GB", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}{" "}
                              -{" "}
                              {end.toLocaleTimeString("en-GB", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {shift.siteTag ?? shift.roleTag ?? "Shift"}
                            </div>
                          </div>
                        );
                      })}
                      {!timelineShifts.length && (
                        <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                          No shifts for this day.
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {!selectedDayKey && (
              <Card>
                <CardHeader className="border-b">
                  <CardTitle>Day Timeline</CardTitle>
                  <CardDescription>Select a day to see time blocks.</CardDescription>
                </CardHeader>
                <CardContent className="pt-4 text-sm text-muted-foreground">
                  Pick any day on the calendar to view its shifts.
                </CardContent>
              </Card>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
