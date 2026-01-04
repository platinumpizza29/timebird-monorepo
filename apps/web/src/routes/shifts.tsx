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

export const Route = createFileRoute("/shifts")({
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

function toLocalInputValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function RouteComponent() {
  const queryClient = useQueryClient();
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [editShiftId, setEditShiftId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    start: "",
    end: "",
    breakMinutes: "",
    tag: "",
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

  const shiftListQuery = useQuery(
    orpc.shift.list.queryOptions({
      input: { jobId: selectedJobId, limit: 50, sort: "startDesc" },
      enabled: Boolean(selectedJobId),
    }),
  );

  const rangeInput = useMemo(() => {
    if (!selectedJobId) return null;
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - 56);
    return {
      jobId: selectedJobId,
      fromUtc: from.toISOString(),
      toUtc: to.toISOString(),
      bucket: "week" as const,
    };
  }, [selectedJobId]);

  const rangeSummaryQuery = useQuery(
    orpc.summary.range.queryOptions({
      input: rangeInput ?? {
        jobId: selectedJobId,
        fromUtc: new Date().toISOString(),
        toUtc: new Date().toISOString(),
        bucket: "week",
      },
      enabled: Boolean(rangeInput),
    }),
  );

  const updateShift = useMutation(
    orpc.shift.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries();
        setEditShiftId(null);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to update shift");
      },
    }),
  );

  const deleteShift = useMutation(
    orpc.shift.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries();
      },
      onError: (error) => {
        toast.error(error.message || "Failed to delete shift");
      },
    }),
  );

  const formatMinutes = (minutes?: number) => {
    if (minutes === undefined) return "—";
    const hours = Math.floor(minutes / 60);
    const remaining = minutes % 60;
    return `${hours}h ${remaining}m`;
  };

  const chartData = rangeSummaryQuery.data?.buckets ?? [];
  const maxMinutes =
    chartData.length > 0
      ? Math.max(...chartData.map((item) => item.totalMinutes))
      : 1;

  return (
    <div className="min-h-svh bg-background">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6">
        <section className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">All Shifts</h1>
            <p className="text-sm text-muted-foreground">Edit, update, or remove shifts.</p>
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
              <CardTitle>Shift List</CardTitle>
              <CardDescription>Most recent shifts for the selected job.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              {shiftListQuery.data?.items?.length ? (
                shiftListQuery.data.items.map((shift) => {
                  const isEditing = editShiftId === shift.shiftId;
                  const start = new Date(shift.startUtc);
                  const end = new Date(shift.endUtc);
                  return (
                    <div
                      key={shift.shiftId}
                      className="flex flex-col gap-3 border-b pb-4 last:border-b-0 last:pb-0"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">
                            {start.toLocaleDateString("en-GB", {
                              weekday: "short",
                              day: "2-digit",
                              month: "short",
                            })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {start.toLocaleTimeString("en-GB", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}{" "}
                            →{" "}
                            {end.toLocaleTimeString("en-GB", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">
                            {formatMinutes(shift.payableMinutes)}
                          </p>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditShiftId(isEditing ? null : shift.shiftId);
                              setEditForm({
                                start: toLocalInputValue(start),
                                end: toLocalInputValue(end),
                                breakMinutes: "",
                                tag: shift.siteTag ?? shift.roleTag ?? "",
                              });
                            }}
                          >
                            {isEditing ? "Close" : "Edit"}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              if (confirm("Delete this shift?")) {
                                deleteShift.mutate({ shiftId: shift.shiftId });
                              }
                            }}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                      {isEditing && (
                        <div className="grid gap-3 rounded-none border p-3">
                          <div className="grid gap-2">
                            <label className="text-xs font-medium">Start</label>
                            <Input
                              type="datetime-local"
                              value={editForm.start}
                              onChange={(event) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  start: event.target.value,
                                }))
                              }
                            />
                          </div>
                          <div className="grid gap-2">
                            <label className="text-xs font-medium">End</label>
                            <Input
                              type="datetime-local"
                              value={editForm.end}
                              onChange={(event) =>
                                setEditForm((prev) => ({ ...prev, end: event.target.value }))
                              }
                            />
                          </div>
                          <div className="grid gap-2">
                            <label className="text-xs font-medium">Unpaid break (mins)</label>
                            <Input
                              type="number"
                              placeholder="30"
                              value={editForm.breakMinutes}
                              onChange={(event) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  breakMinutes: event.target.value,
                                }))
                              }
                            />
                          </div>
                          <div className="grid gap-2">
                            <label className="text-xs font-medium">Role or site</label>
                            <Input
                              value={editForm.tag}
                              onChange={(event) =>
                                setEditForm((prev) => ({ ...prev, tag: event.target.value }))
                              }
                            />
                          </div>
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditShiftId(null)}
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => {
                                const breakMinutes = Number(editForm.breakMinutes || 0);
                                updateShift.mutate({
                                  shiftId: shift.shiftId,
                                  patch: {
                                    startUtc: new Date(editForm.start).toISOString(),
                                    endUtc: new Date(editForm.end).toISOString(),
                                    breaks:
                                      breakMinutes > 0
                                        ? [{ minutes: breakMinutes, paid: false }]
                                        : [],
                                    siteTag: editForm.tag || null,
                                  },
                                });
                              }}
                            >
                              Save
                            </Button>
                          </div>
                        </div>
                      )}
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

          <div className="grid gap-6">
            <Card>
              <CardHeader className="border-b">
                <CardTitle>Weekly Hours</CardTitle>
                <CardDescription>Last 8 weeks of payable time.</CardDescription>
                <CardAction>
                  <span className="text-xs text-muted-foreground">
                    {rangeInput ? "Auto-updated" : "Select a job"}
                  </span>
                </CardAction>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="flex items-end gap-2">
                  {chartData.map((item) => {
                    const height = Math.max(
                      10,
                      Math.round((item.totalMinutes / maxMinutes) * 120),
                    );
                    return (
                      <div key={item.startUtc} className="flex flex-col items-center gap-2">
                        <div
                          className="w-6 rounded-none bg-primary/80"
                          style={{ height }}
                          title={`${formatMinutes(item.totalMinutes)}`}
                        />
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(item.startUtc).toLocaleDateString("en-GB", {
                            month: "short",
                            day: "2-digit",
                          })}
                        </span>
                      </div>
                    );
                  })}
                  {!chartData.length && (
                    <p className="text-sm text-muted-foreground">No data yet.</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="border-b">
                <CardTitle>Overtime Snapshot</CardTitle>
                <CardDescription>Minutes per week at a glance.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-4">
                {chartData.map((item) => (
                  <div key={item.startUtc} className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {new Date(item.startUtc).toLocaleDateString("en-GB", {
                        month: "short",
                        day: "2-digit",
                      })}
                    </span>
                    <span className="text-sm font-medium">
                      {formatMinutes(item.overtimeMinutes)}
                    </span>
                  </div>
                ))}
                {!chartData.length && (
                  <p className="text-sm text-muted-foreground">No overtime data yet.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </div>
  );
}
