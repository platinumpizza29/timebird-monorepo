import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/dashboard")({
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

function RouteComponent() {
  const { session } = Route.useRouteContext();
  const firstName = session.data?.user.name?.split(" ")[0] ?? "there";
  const queryClient = useQueryClient();
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [showAllShifts, setShowAllShifts] = useState(false);
  const [shiftForm, setShiftForm] = useState({
    start: "",
    end: "",
    breakMinutes: "",
    tag: "",
  });
  const [jobForm, setJobForm] = useState({
    name: "",
    hourlyRate: "",
    contractedHours: "",
    payCycle: "weekly",
    weekday: "1",
    monthday: "1",
    anchorStartDate: "",
    timezone: "Europe/London",
  });

  const jobListQuery = useQuery(
    orpc.job.list.queryOptions({
      input: { limit: 20, activeOnly: true },
    }),
  );

  const userSettingsQuery = useQuery(orpc.userSettings.get.queryOptions());

  useEffect(() => {
    if (!selectedJobId && jobListQuery.data?.items?.length) {
      setSelectedJobId(jobListQuery.data.items[0].jobId);
    }
  }, [jobListQuery.data?.items, selectedJobId]);

  useEffect(() => {
    if (!userSettingsQuery.data) return;
    if (jobForm.name || jobForm.hourlyRate) return;
    setJobForm((prev) => ({
      ...prev,
      payCycle: userSettingsQuery.data.payCycle ?? prev.payCycle,
      timezone: userSettingsQuery.data.timezone ?? prev.timezone,
      hourlyRate: userSettingsQuery.data.hourlyRate
        ? (userSettingsQuery.data.hourlyRate.amount / 100).toFixed(2)
        : prev.hourlyRate,
      contractedHours: userSettingsQuery.data.contractedMinutesPerWeek
        ? String(Math.round(userSettingsQuery.data.contractedMinutesPerWeek / 60))
        : prev.contractedHours,
      weekday: userSettingsQuery.data.payPeriodAnchor.weekday?.toString() ?? prev.weekday,
      monthday: userSettingsQuery.data.payPeriodAnchor.monthday?.toString() ?? prev.monthday,
      anchorStartDate: userSettingsQuery.data.payPeriodAnchor.startDateUtc
        ? new Date(userSettingsQuery.data.payPeriodAnchor.startDateUtc)
            .toISOString()
            .slice(0, 10)
        : prev.anchorStartDate,
    }));
  }, [jobForm.hourlyRate, jobForm.name, userSettingsQuery.data]);

  const jobQuery = useQuery(
    orpc.job.get.queryOptions({
      input: { jobId: selectedJobId },
      enabled: Boolean(selectedJobId),
    }),
  );

  const timezone = jobQuery.data?.timezone ?? "Europe/London";

  const payPeriodQuery = useQuery(
    orpc.payPeriod.current.queryOptions({
      input: { jobId: selectedJobId },
      enabled: Boolean(selectedJobId),
    }),
  );

  const payPeriodRangeInput = useMemo(() => {
    if (!payPeriodQuery.data) {
      return null;
    }
    return {
      jobId: selectedJobId,
      periodStartUtc: payPeriodQuery.data.periodStartUtc,
      periodEndUtc: payPeriodQuery.data.periodEndUtc,
    };
  }, [payPeriodQuery.data, selectedJobId]);

  const summaryQuery = useQuery(
    orpc.summary.payPeriod.queryOptions({
      input: payPeriodRangeInput ?? {
        jobId: selectedJobId,
        periodStartUtc: new Date().toISOString(),
        periodEndUtc: new Date().toISOString(),
      },
      enabled: Boolean(payPeriodRangeInput && selectedJobId),
    }),
  );

  const monthKey = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = `${now.getMonth() + 1}`.padStart(2, "0");
    return `${year}-${month}`;
  }, []);

  const monthSummaryQuery = useQuery(
    orpc.summary.month.queryOptions({
      input: { jobId: selectedJobId, month: monthKey },
      enabled: Boolean(selectedJobId),
    }),
  );

  const shiftListQuery = useQuery(
    orpc.shift.list.queryOptions({
      input: {
        jobId: selectedJobId,
        limit: showAllShifts ? 12 : 3,
        sort: "startDesc",
      },
      enabled: Boolean(selectedJobId),
    }),
  );

  const createShift = useMutation(
    orpc.shift.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries();
        setShiftForm({ start: "", end: "", breakMinutes: "", tag: "" });
      },
      onError: (error) => {
        toast.error(error.message || "Failed to save shift");
      },
    }),
  );

  const createJob = useMutation(
    orpc.job.create.mutationOptions({
      onSuccess: (data) => {
        queryClient.invalidateQueries();
        setSelectedJobId(data.jobId);
        setJobForm({
          name: "",
          hourlyRate: "",
          contractedHours: "",
          payCycle: "weekly",
          weekday: "1",
          monthday: "1",
          anchorStartDate: "",
          timezone: "Europe/London",
        });
      },
    }),
  );

  const formatDateRange = (start?: string, end?: string) => {
    if (!start || !end) return "—";
    const formatter = new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      timeZone: timezone,
    });
    return `${formatter.format(new Date(start))} → ${formatter.format(new Date(end))}`;
  };

  const formatMoney = (amountMinor?: number, currency?: string) => {
    if (amountMinor === undefined) return "—";
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency ?? "GBP",
      maximumFractionDigits: 2,
    }).format(amountMinor / 100);
  };

  const formatMinutes = (minutes?: number | null) => {
    if (minutes === undefined || minutes === null) return "—";
    const hours = Math.floor(minutes / 60);
    const remaining = minutes % 60;
    return `${hours}h ${remaining}m`;
  };

  const canCreateJob = (() => {
    if (!jobForm.name.trim()) return false;
    if (!jobForm.hourlyRate.trim()) return false;
    if (jobForm.payCycle === "monthly" && !jobForm.monthday.trim()) return false;
    if (
      (jobForm.payCycle === "bi_weekly" || jobForm.payCycle === "four_weekly") &&
      !jobForm.anchorStartDate.trim()
    ) {
      return false;
    }
    return true;
  })();

  const canSaveShift = (() => {
    if (!selectedJobId || !shiftForm.start || !shiftForm.end) return false;
    const start = new Date(shiftForm.start);
    const end = new Date(shiftForm.end);
    return Number.isFinite(start.getTime()) && Number.isFinite(end.getTime()) && end > start;
  })();

  return (
    <div className="min-h-svh bg-background">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6">
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold">Welcome back, {firstName}</h1>
              <p className="text-sm text-muted-foreground">Track shifts and pay periods.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => {
                  const element = document.getElementById("log-shift");
                  if (element) {
                    element.scrollIntoView({ behavior: "smooth", block: "start" });
                  }
                }}
              >
                Log Shift
              </Button>
            </div>
          </div>
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Active Job</CardTitle>
              <CardDescription>
                {jobQuery.data
                  ? `${jobQuery.data.hourlyRate.currency} · ${jobQuery.data.timezone} · ${jobQuery.data.payCycle.replaceAll(
                      "_",
                      " ",
                    )}`
                  : "Select a job to start tracking."}
              </CardDescription>
              <CardAction>
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
              </CardAction>
            </CardHeader>
            <CardContent className="grid gap-4 pt-4 sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">Current pay period</p>
                <p className="text-lg font-semibold">
                  {formatDateRange(
                    payPeriodQuery.data?.periodStartUtc,
                    payPeriodQuery.data?.periodEndUtc,
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Hours so far</p>
                <p className="text-lg font-semibold">
                  {formatMinutes(summaryQuery.data?.totalMinutes)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Projected earnings</p>
                <p className="text-lg font-semibold">
                  {formatMoney(
                    summaryQuery.data?.projectedEarnings.amount,
                    summaryQuery.data?.projectedEarnings.currency,
                  )}
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <div className="grid gap-6">
            <Card>
              <CardHeader className="border-b">
                <CardTitle>Pay Period Summary</CardTitle>
                <CardDescription>Live totals and overtime.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 pt-4 sm:grid-cols-3">
                <div className="rounded-none border p-4">
                  <p className="text-xs text-muted-foreground">Gross so far</p>
                  <p className="text-xl font-semibold">
                    {formatMoney(
                      summaryQuery.data?.grossEarnings.amount,
                      summaryQuery.data?.grossEarnings.currency,
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    + {formatMinutes(summaryQuery.data?.overtimeMinutes)} overtime
                  </p>
                </div>
                <div className="rounded-none border p-4">
                  <p className="text-xs text-muted-foreground">Overtime</p>
                  <p className="text-xl font-semibold">
                    {formatMinutes(summaryQuery.data?.overtimeMinutes)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {jobQuery.data?.overtimeRule
                      ? `${jobQuery.data.overtimeRule.multiplier ?? 1.5}x multiplier`
                      : "No overtime rule"}
                  </p>
                </div>
                <div className="rounded-none border p-4">
                  <p className="text-xs text-muted-foreground">Month-to-date</p>
                  <p className="text-xl font-semibold">
                    {formatMinutes(monthSummaryQuery.data?.totalMinutes)} ·{" "}
                    {formatMoney(
                      monthSummaryQuery.data?.grossEarnings.amount,
                      monthSummaryQuery.data?.grossEarnings.currency,
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Intl.DateTimeFormat("en-GB", {
                      month: "long",
                      year: "numeric",
                      timeZone: timezone,
                    }).format(new Date())}{" "}
                    totals
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="border-b">
                <CardTitle>Recent Shifts</CardTitle>
                <CardDescription>Latest entries with payable time and tags.</CardDescription>
                <CardAction>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowAllShifts((prev) => !prev)}
                  >
                    {showAllShifts ? "Show less" : "View all"}
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent className="space-y-3 pt-4">
                {shiftListQuery.data?.items?.length ? (
                  shiftListQuery.data.items.map((shift) => {
                    const start = new Date(shift.startUtc);
                    const end = new Date(shift.endUtc);
                    const dateLabel = new Intl.DateTimeFormat("en-GB", {
                      weekday: "short",
                      day: "2-digit",
                      month: "short",
                      timeZone: timezone,
                    }).format(start);
                    const timeLabel = `${new Intl.DateTimeFormat("en-GB", {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                      timeZone: timezone,
                    }).format(start)}–${new Intl.DateTimeFormat("en-GB", {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                      timeZone: timezone,
                    }).format(end)}`;
                    return (
                      <div
                        key={shift.shiftId}
                        className="flex flex-wrap items-center justify-between gap-3 border-b pb-3 last:border-b-0 last:pb-0"
                      >
                        <div>
                          <p className="text-sm font-medium">{dateLabel}</p>
                          <p className="text-xs text-muted-foreground">{timeLabel}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">
                            {formatMinutes(shift.payableMinutes)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {shift.siteTag ?? shift.roleTag ?? "Shift"}
                          </p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {selectedJobId ? "No shifts logged yet." : "Select a job to view shifts."}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6">
            <Card id="create-job">
              <CardHeader className="border-b">
                <CardTitle>Create Job</CardTitle>
                <CardDescription>Set rate and pay cycle to start logging shifts.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-4">
                <div className="grid gap-2">
                  <label className="text-xs font-medium">Job name</label>
                  <Input
                    placeholder="Warehouse Assistant"
                    value={jobForm.name}
                    onChange={(event) =>
                      setJobForm((prev) => ({ ...prev, name: event.target.value }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-xs font-medium">Hourly rate (GBP)</label>
                  <Input
                    type="number"
                    placeholder="12.50"
                    value={jobForm.hourlyRate}
                    onChange={(event) =>
                      setJobForm((prev) => ({ ...prev, hourlyRate: event.target.value }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-xs font-medium">Contracted hours per week</label>
                  <Input
                    type="number"
                    placeholder="40"
                    value={jobForm.contractedHours}
                    onChange={(event) =>
                      setJobForm((prev) => ({
                        ...prev,
                        contractedHours: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-xs font-medium">Pay cycle</label>
                  <select
                    value={jobForm.payCycle}
                    onChange={(event) =>
                      setJobForm((prev) => ({ ...prev, payCycle: event.target.value }))
                    }
                    className="border-border bg-background text-foreground h-8 rounded-none border px-2 text-xs"
                  >
                    <option value="weekly">Weekly</option>
                    <option value="bi_weekly">Bi-weekly</option>
                    <option value="four_weekly">Four-weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                {jobForm.payCycle === "monthly" ? (
                  <div className="grid gap-2">
                    <label className="text-xs font-medium">Pay period anchor day</label>
                    <Input
                      type="number"
                      placeholder="1"
                      value={jobForm.monthday}
                      onChange={(event) =>
                        setJobForm((prev) => ({ ...prev, monthday: event.target.value }))
                      }
                    />
                  </div>
                ) : (
                  <div className="grid gap-2">
                    <label className="text-xs font-medium">Pay period start weekday</label>
                    <select
                      value={jobForm.weekday}
                      onChange={(event) =>
                        setJobForm((prev) => ({ ...prev, weekday: event.target.value }))
                      }
                      className="border-border bg-background text-foreground h-8 rounded-none border px-2 text-xs"
                    >
                      <option value="1">Monday</option>
                      <option value="2">Tuesday</option>
                      <option value="3">Wednesday</option>
                      <option value="4">Thursday</option>
                      <option value="5">Friday</option>
                      <option value="6">Saturday</option>
                      <option value="0">Sunday</option>
                    </select>
                  </div>
                )}
                {(jobForm.payCycle === "bi_weekly" || jobForm.payCycle === "four_weekly") && (
                  <div className="grid gap-2">
                    <label className="text-xs font-medium">Anchor start date</label>
                    <Input
                      type="date"
                      value={jobForm.anchorStartDate}
                      onChange={(event) =>
                        setJobForm((prev) => ({
                          ...prev,
                          anchorStartDate: event.target.value,
                        }))
                      }
                    />
                  </div>
                )}
                <div className="grid gap-2">
                  <label className="text-xs font-medium">Timezone</label>
                  <Input
                    placeholder="Europe/London"
                    value={jobForm.timezone}
                    onChange={(event) =>
                      setJobForm((prev) => ({ ...prev, timezone: event.target.value }))
                    }
                  />
                </div>
                <Button
                  className="w-full"
                  disabled={!canCreateJob || createJob.isPending}
                  onClick={() => {
                    const hourlyRate = Number(jobForm.hourlyRate);
                    if (!Number.isFinite(hourlyRate) || hourlyRate <= 0) {
                      return;
                    }
                    const contractedMinutes = jobForm.contractedHours
                      ? Math.round(Number(jobForm.contractedHours) * 60)
                      : undefined;
                    const payPeriodAnchor =
                      jobForm.payCycle === "monthly"
                        ? { monthday: Number(jobForm.monthday) }
                        : {
                            weekday: Number(jobForm.weekday),
                            startDateUtc: jobForm.anchorStartDate
                              ? new Date(`${jobForm.anchorStartDate}T00:00:00`).toISOString()
                              : undefined,
                          };
                    createJob.mutate({
                      name: jobForm.name,
                      hourlyRate: {
                        amount: Math.round(hourlyRate * 100),
                        currency: "GBP",
                      },
                      contractedMinutesPerWeek: contractedMinutes,
                      payCycle: jobForm.payCycle as
                        | "weekly"
                        | "bi_weekly"
                        | "four_weekly"
                        | "monthly",
                      payPeriodAnchor,
                      timezone: jobForm.timezone || "Europe/London",
                    });
                  }}
                >
                  {createJob.isPending ? "Creating..." : "Create job"}
                </Button>
              </CardContent>
            </Card>

            <Card id="log-shift">
              <CardHeader className="border-b">
                <CardTitle>Log a Shift</CardTitle>
                <CardDescription>Quick entry, UK format, auto break rules.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-4">
                <div className="grid gap-2">
                  <label className="text-xs font-medium">Start</label>
                  <Input
                    type="datetime-local"
                    value={shiftForm.start}
                    onChange={(event) =>
                      setShiftForm((prev) => ({ ...prev, start: event.target.value }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-xs font-medium">End</label>
                  <Input
                    type="datetime-local"
                    value={shiftForm.end}
                    onChange={(event) =>
                      setShiftForm((prev) => ({ ...prev, end: event.target.value }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-xs font-medium">Unpaid break (mins)</label>
                  <Input
                    type="number"
                    placeholder="30"
                    value={shiftForm.breakMinutes}
                    onChange={(event) =>
                      setShiftForm((prev) => ({
                        ...prev,
                        breakMinutes: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-xs font-medium">Role or site</label>
                  <Input
                    placeholder="Warehouse / Site A"
                    value={shiftForm.tag}
                    onChange={(event) =>
                      setShiftForm((prev) => ({ ...prev, tag: event.target.value }))
                    }
                  />
                </div>
                <Button
                  className="w-full"
                  disabled={!canSaveShift || createShift.isPending}
                  onClick={() => {
                    if (!canSaveShift) {
                      return;
                    }
                    const breakMinutes = Number(shiftForm.breakMinutes || 0);
                    createShift.mutate({
                      jobId: selectedJobId,
                      startUtc: new Date(shiftForm.start).toISOString(),
                      endUtc: new Date(shiftForm.end).toISOString(),
                      breaks:
                        breakMinutes > 0 ? [{ minutes: breakMinutes, paid: false }] : undefined,
                      siteTag: shiftForm.tag || undefined,
                    });
                  }}
                >
                  {createShift.isPending ? "Saving..." : "Save shift"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </div>
  );
}
