import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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

export const Route = createFileRoute("/profile")({
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

// Normalize date input for the profile form.
function toDateInputValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Profile settings for defaults, pay cycles, and overtime rules.
function RouteComponent() {
  const queryClient = useQueryClient();
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [form, setForm] = useState({
    hourlyRate: "",
    contractedHours: "",
    payCycle: "weekly",
    weekday: "1",
    monthday: "1",
    anchorStartDate: "",
    timezone: "Europe/London",
    standardBreakMinutes: "",
    roundingMinutes: "",
    roundingMode: "nearest",
    overtimeDailyHours: "",
    overtimeWeeklyHours: "",
    overtimeMultiplier: "",
  });

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

  const settingsQuery = useQuery(orpc.userSettings.get.queryOptions());

  useEffect(() => {
    if (!settingsQuery.data) return;
    const anchorStartDate = settingsQuery.data.payPeriodAnchor.startDateUtc
      ? toDateInputValue(new Date(settingsQuery.data.payPeriodAnchor.startDateUtc))
      : "";
    setForm({
      hourlyRate: settingsQuery.data.hourlyRate
        ? (settingsQuery.data.hourlyRate.amount / 100).toFixed(2)
        : "",
      contractedHours: settingsQuery.data.contractedMinutesPerWeek
        ? String(Math.round(settingsQuery.data.contractedMinutesPerWeek / 60))
        : "",
      payCycle: settingsQuery.data.payCycle,
      weekday: settingsQuery.data.payPeriodAnchor.weekday?.toString() ?? "1",
      monthday: settingsQuery.data.payPeriodAnchor.monthday?.toString() ?? "1",
      anchorStartDate,
      timezone: settingsQuery.data.timezone ?? "Europe/London",
      standardBreakMinutes: settingsQuery.data.standardBreak?.minutes?.toString() ?? "",
      roundingMinutes: settingsQuery.data.rounding?.minutes?.toString() ?? "",
      roundingMode: settingsQuery.data.rounding?.mode ?? "nearest",
      overtimeDailyHours: settingsQuery.data.overtimeRule?.dailyThresholdMinutes
        ? String(Math.round(settingsQuery.data.overtimeRule.dailyThresholdMinutes / 60))
        : "",
      overtimeWeeklyHours: settingsQuery.data.overtimeRule?.weeklyThresholdMinutes
        ? String(Math.round(settingsQuery.data.overtimeRule.weeklyThresholdMinutes / 60))
        : "",
      overtimeMultiplier: settingsQuery.data.overtimeRule?.multiplier?.toString() ?? "",
    });
  }, [settingsQuery.data]);

  const updateSettings = useMutation(
    orpc.userSettings.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries();
        toast.success("Defaults updated");
      },
      onError: (error) => {
        toast.error(error.message || "Failed to update");
      },
    }),
  );

  const applyDefaults = useMutation(
    orpc.job.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries();
        toast.success("Defaults applied to job");
      },
      onError: (error) => {
        toast.error(error.message || "Failed to apply defaults");
      },
    }),
  );

  const canSave = Boolean(form.hourlyRate.trim());

  return (
    <div className="min-h-svh bg-background">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6">
        <section className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Profile Settings</h1>
            <p className="text-sm text-muted-foreground">
              Set your default pay cycle, anchor day, and rates.
            </p>
          </div>
        </section>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Default Profile</CardTitle>
            <CardDescription>Used when creating new jobs.</CardDescription>
            <CardAction>
              <span className="text-xs text-muted-foreground">
                {settingsQuery.isLoading ? "Loading..." : "UK defaults"}
              </span>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <label className="text-xs font-medium">Timezone</label>
                <Input
                  value={form.timezone}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, timezone: event.target.value }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <label className="text-xs font-medium">Hourly rate (GBP)</label>
                <Input
                  type="number"
                  value={form.hourlyRate}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, hourlyRate: event.target.value }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <label className="text-xs font-medium">Contracted hours/week</label>
                <Input
                  type="number"
                  value={form.contractedHours}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, contractedHours: event.target.value }))
                  }
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <label className="text-xs font-medium">Pay cycle</label>
                <select
                  value={form.payCycle}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, payCycle: event.target.value }))
                  }
                  className="border-border bg-background text-foreground h-8 rounded-none border px-2 text-xs"
                >
                  <option value="weekly">Weekly</option>
                  <option value="bi_weekly">Bi-weekly</option>
                  <option value="four_weekly">Four-weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              {form.payCycle === "monthly" ? (
                <div className="grid gap-2">
                  <label className="text-xs font-medium">Anchor day (month)</label>
                  <Input
                    type="number"
                    value={form.monthday}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, monthday: event.target.value }))
                    }
                  />
                </div>
              ) : (
                <div className="grid gap-2">
                  <label className="text-xs font-medium">Anchor weekday</label>
                  <select
                    value={form.weekday}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, weekday: event.target.value }))
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
              {(form.payCycle === "bi_weekly" || form.payCycle === "four_weekly") && (
                <div className="grid gap-2">
                  <label className="text-xs font-medium">Anchor start date</label>
                  <Input
                    type="date"
                    value={form.anchorStartDate}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, anchorStartDate: event.target.value }))
                    }
                  />
                </div>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <label className="text-xs font-medium">Standard break (mins)</label>
                <Input
                  type="number"
                  value={form.standardBreakMinutes}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      standardBreakMinutes: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <label className="text-xs font-medium">Rounding minutes</label>
                <Input
                  type="number"
                  value={form.roundingMinutes}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, roundingMinutes: event.target.value }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <label className="text-xs font-medium">Rounding mode</label>
                <select
                  value={form.roundingMode}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, roundingMode: event.target.value }))
                  }
                  className="border-border bg-background text-foreground h-8 rounded-none border px-2 text-xs"
                >
                  <option value="nearest">Nearest</option>
                  <option value="floor">Floor</option>
                  <option value="ceil">Ceil</option>
                </select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="grid gap-2">
                <label className="text-xs font-medium">OT daily hours</label>
                <Input
                  type="number"
                  value={form.overtimeDailyHours}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, overtimeDailyHours: event.target.value }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <label className="text-xs font-medium">OT weekly hours</label>
                <Input
                  type="number"
                  value={form.overtimeWeeklyHours}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, overtimeWeeklyHours: event.target.value }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <label className="text-xs font-medium">OT multiplier</label>
                <Input
                  type="number"
                  placeholder="1.5"
                  value={form.overtimeMultiplier}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, overtimeMultiplier: event.target.value }))
                  }
                />
              </div>
            </div>

            <div className="flex items-center justify-end">
              <Button
                disabled={!canSave || updateSettings.isPending}
                onClick={() => {
                  const hourlyRate = Number(form.hourlyRate);
                  if (!Number.isFinite(hourlyRate) || hourlyRate <= 0) {
                    toast.error("Hourly rate must be a positive number");
                    return;
                  }
                  const contractedMinutes = form.contractedHours
                    ? Math.round(Number(form.contractedHours) * 60)
                    : null;
                  const payPeriodAnchor =
                    form.payCycle === "monthly"
                      ? { monthday: Number(form.monthday) }
                      : {
                          weekday: Number(form.weekday),
                          startDateUtc: form.anchorStartDate
                            ? new Date(`${form.anchorStartDate}T00:00:00`).toISOString()
                            : undefined,
                        };
                  const standardBreak = form.standardBreakMinutes
                    ? { minutes: Number(form.standardBreakMinutes), paid: false }
                    : null;
                  const rounding = form.roundingMinutes
                    ? {
                        minutes: Number(form.roundingMinutes),
                        mode: form.roundingMode as "nearest" | "floor" | "ceil",
                      }
                    : null;
                  const overtimeRule =
                    form.overtimeDailyHours ||
                    form.overtimeWeeklyHours ||
                    form.overtimeMultiplier
                      ? {
                          dailyThresholdMinutes: form.overtimeDailyHours
                            ? Math.round(Number(form.overtimeDailyHours) * 60)
                            : undefined,
                          weeklyThresholdMinutes: form.overtimeWeeklyHours
                            ? Math.round(Number(form.overtimeWeeklyHours) * 60)
                            : undefined,
                          multiplier: form.overtimeMultiplier
                            ? Number(form.overtimeMultiplier)
                            : undefined,
                        }
                      : null;

                  updateSettings.mutate({
                    patch: {
                      timezone: form.timezone || "Europe/London",
                      hourlyRate: { amount: Math.round(hourlyRate * 100), currency: "GBP" },
                      contractedMinutesPerWeek: contractedMinutes ?? undefined,
                      payCycle: form.payCycle as
                        | "weekly"
                        | "bi_weekly"
                        | "four_weekly"
                        | "monthly",
                      payPeriodAnchor,
                      standardBreak,
                      rounding,
                      overtimeRule,
                    },
                  });
                }}
              >
                {updateSettings.isPending ? "Saving..." : "Save defaults"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Apply Defaults to Job</CardTitle>
            <CardDescription>Overwrite an existing job with your defaults.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3 pt-4">
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
            <Button
              variant="outline"
              disabled={!selectedJobId || applyDefaults.isPending}
              onClick={() => {
                if (!selectedJobId) return;
                if (!confirm("Apply defaults to this job?")) return;
                const hourlyRate = Number(form.hourlyRate);
                const contractedMinutes = form.contractedHours
                  ? Math.round(Number(form.contractedHours) * 60)
                  : null;
                const payPeriodAnchor =
                  form.payCycle === "monthly"
                    ? { monthday: Number(form.monthday) }
                    : {
                        weekday: Number(form.weekday),
                        startDateUtc: form.anchorStartDate
                          ? new Date(`${form.anchorStartDate}T00:00:00`).toISOString()
                          : undefined,
                      };
                const standardBreak = form.standardBreakMinutes
                  ? { minutes: Number(form.standardBreakMinutes), paid: false }
                  : null;
                const rounding = form.roundingMinutes
                  ? {
                      minutes: Number(form.roundingMinutes),
                      mode: form.roundingMode as "nearest" | "floor" | "ceil",
                    }
                  : null;
                const overtimeRule =
                  form.overtimeDailyHours ||
                  form.overtimeWeeklyHours ||
                  form.overtimeMultiplier
                    ? {
                        dailyThresholdMinutes: form.overtimeDailyHours
                          ? Math.round(Number(form.overtimeDailyHours) * 60)
                          : undefined,
                        weeklyThresholdMinutes: form.overtimeWeeklyHours
                          ? Math.round(Number(form.overtimeWeeklyHours) * 60)
                          : undefined,
                        multiplier: form.overtimeMultiplier
                          ? Number(form.overtimeMultiplier)
                          : undefined,
                      }
                    : null;

                applyDefaults.mutate({
                  jobId: selectedJobId,
                  patch: {
                    timezone: form.timezone || "Europe/London",
                    hourlyRate: { amount: Math.round(hourlyRate * 100), currency: "GBP" },
                    contractedMinutesPerWeek: contractedMinutes ?? undefined,
                    payCycle: form.payCycle as
                      | "weekly"
                      | "bi_weekly"
                      | "four_weekly"
                      | "monthly",
                    payPeriodAnchor,
                    standardBreak,
                    rounding,
                    overtimeRule,
                  },
                });
              }}
            >
              {applyDefaults.isPending ? "Applying..." : "Apply defaults"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
