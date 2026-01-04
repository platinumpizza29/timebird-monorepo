import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import DateTimePicker from "@react-native-community/datetimepicker";
import { router } from "expo-router";
import { Button, Card, TextField } from "heroui-native";
import { Alert, Modal as RNModal, Platform, ScrollView, Text, View } from "react-native";
import { useEffect, useMemo, useState } from "react";

import { Container } from "@/components/container";
import { orpc } from "@/utils/orpc";

const weekDayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toLocalInputValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseLocalInput(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

export default function Shifts() {
  const queryClient = useQueryClient();
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [filter, setFilter] = useState<"all" | "week" | "overtime">("all");
  const [editShiftId, setEditShiftId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    start: "",
    end: "",
    breakMinutes: "",
    tag: "",
  });
  const [editPicker, setEditPicker] = useState<{
    field: "start" | "end";
    mode: "date" | "time" | "datetime";
  } | null>(null);
  const [androidTempDate, setAndroidTempDate] = useState<Date | null>(null);
  const [editStartDate, setEditStartDate] = useState<Date | null>(null);
  const [editEndDate, setEditEndDate] = useState<Date | null>(null);

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

  const shiftListInput = useMemo(() => {
    if (!selectedJobId) return null;
    const input: {
      jobId: string;
      limit: number;
      sort: "startAsc" | "startDesc";
      fromUtc?: string;
      toUtc?: string;
    } = {
      jobId: selectedJobId,
      limit: 50,
      sort: "startDesc",
    };
    if (filter === "week") {
      const now = new Date();
      const start = new Date(now);
      const diff = (now.getDay() + 6) % 7;
      start.setDate(now.getDate() - diff);
      start.setHours(0, 0, 0, 0);
      input.fromUtc = start.toISOString();
      input.toUtc = now.toISOString();
    }
    return input;
  }, [filter, selectedJobId]);

  const shiftListQuery = useQuery(
    orpc.shift.list.queryOptions({
      input: shiftListInput ?? {
        jobId: selectedJobId,
        limit: 50,
        sort: "startDesc",
      },
      enabled: Boolean(shiftListInput),
    }),
  );

  const updateShift = useMutation(
    orpc.shift.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries();
        setEditShiftId(null);
      },
      onError: (error) => {
        Alert.alert("Update failed", error.message || "Unable to update shift.");
      },
    }),
  );

  const deleteShift = useMutation(
    orpc.shift.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries();
      },
      onError: (error) => {
        Alert.alert("Delete failed", error.message || "Unable to delete shift.");
      },
    }),
  );

  const filteredShifts = useMemo(() => {
    const items = shiftListQuery.data?.items ?? [];
    if (filter !== "overtime") return items;
    return items.filter((shift) => shift.payableMinutes >= 8 * 60);
  }, [filter, shiftListQuery.data?.items]);

  const formatMinutes = (minutes?: number | null) => {
    if (minutes === undefined || minutes === null) return "—";
    const hours = Math.floor(minutes / 60);
    const remaining = minutes % 60;
    return `${hours}h ${remaining}m`;
  };

  const formatDateTime = (date: Date) =>
    new Intl.DateTimeFormat("en-GB", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);

  const openEditPicker = (field: "start" | "end") => {
    const baseDate =
      field === "start" ? editStartDate ?? new Date() : editEndDate ?? new Date();
    if (Platform.OS === "android") {
      setAndroidTempDate(baseDate);
      setEditPicker({ field, mode: "date" });
      return;
    }
    setEditPicker({ field, mode: "datetime" });
  };

  const handleEditPickerChange = (
    field: "start" | "end",
    mode: "date" | "time" | "datetime",
    event: { type?: string },
    selected?: Date,
  ) => {
    if (event.type === "dismissed") {
      setEditPicker(null);
      return;
    }
    if (!selected) return;

    if (Platform.OS === "android") {
      if (mode === "date") {
        setAndroidTempDate(selected);
        setEditPicker({ field, mode: "time" });
        return;
      }
      const base = androidTempDate ?? selected;
      const updated = new Date(base);
      updated.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
      if (field === "start") {
        setEditStartDate(updated);
      } else {
        setEditEndDate(updated);
      }
      setEditPicker(null);
      return;
    }

    if (field === "start") {
      setEditStartDate(selected);
    } else {
      setEditEndDate(selected);
    }
  };

  return (
    <Container className="p-6">
      <View className="gap-6">
        <View className="flex-row items-end justify-between">
          <View>
            <Text className="text-2xl font-semibold text-foreground">My Shifts</Text>
            <Text className="text-sm text-muted mt-1">
              Weekly schedule and logged hours.
            </Text>
          </View>
          <Button
            size="sm"
            onPress={() => {
              if (!selectedJobId) {
                Alert.alert("Select a job", "Choose a job before logging a shift.");
                return;
              }
              router.push({ pathname: "/modal", params: { jobId: selectedJobId } });
            }}
          >
            <Button.Label>Log shift</Button.Label>
          </Button>
        </View>

        <View className="gap-3">
          <Text className="text-xs uppercase tracking-[2px] text-muted">Jobs</Text>
          {jobListQuery.data?.items?.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-2">
                {jobListQuery.data.items.map((job) => (
                  <Button
                    key={job.jobId}
                    size="sm"
                    variant={selectedJobId === job.jobId ? "primary" : "secondary"}
                    onPress={() => setSelectedJobId(job.jobId)}
                  >
                    <Button.Label>{job.name}</Button.Label>
                  </Button>
                ))}
              </View>
            </ScrollView>
          ) : (
            <Card variant="secondary" className="rounded-2xl p-4">
              <Text className="text-sm text-muted">No jobs yet.</Text>
            </Card>
          )}
        </View>

        <View className="flex-row gap-2">
          {[
            { label: "All", value: "all" },
            { label: "This week", value: "week" },
            { label: "Overtime", value: "overtime" },
          ].map((item) => (
            <Button
              key={item.value}
              size="sm"
              variant={filter === item.value ? "primary" : "secondary"}
              onPress={() => setFilter(item.value as "all" | "week" | "overtime")}
            >
              <Button.Label>{item.label}</Button.Label>
            </Button>
          ))}
        </View>

        <View className="gap-4">
          {filteredShifts.length ? (
            filteredShifts.map((shift) => {
              const start = new Date(shift.startUtc);
              const end = new Date(shift.endUtc);
              const isEditing = editShiftId === shift.shiftId;
              return (
                <Card key={shift.shiftId} variant="secondary" className="rounded-2xl p-4">
                  <View className="flex-row items-center gap-3">
                    <View className="h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                      <Text className="text-sm font-semibold text-[#2563EB]">
                        {new Intl.DateTimeFormat("en-GB", {
                          day: "2-digit",
                        }).format(start)}
                      </Text>
                      <Text className="text-[10px] text-muted">
                        {new Intl.DateTimeFormat("en-GB", {
                          month: "short",
                        }).format(start)}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-medium text-foreground">
                        {weekDayLabels[start.getDay()]} ·{" "}
                        {new Intl.DateTimeFormat("en-GB", {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false,
                        }).format(start)}{" "}
                        –{" "}
                        {new Intl.DateTimeFormat("en-GB", {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false,
                        }).format(end)}
                      </Text>
                      <Text className="text-xs text-muted">
                        {shift.siteTag ?? shift.roleTag ?? "Shift"}
                      </Text>
                    </View>
                    <View className="items-end">
                      <Text className="text-xs text-muted">
                        {formatMinutes(shift.payableMinutes)}
                      </Text>
                    </View>
                  </View>
                  <View className="mt-3 flex-row items-center justify-between">
                    <Text className="text-xs text-muted">
                      {new Intl.DateTimeFormat("en-GB", {
                        weekday: "long",
                        day: "2-digit",
                        month: "short",
                      }).format(start)}
                    </Text>
                    <View className="flex-row gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onPress={() => {
                          setEditShiftId(isEditing ? null : shift.shiftId);
                          setEditForm({
                            start: toLocalInputValue(start),
                            end: toLocalInputValue(end),
                            breakMinutes: "",
                            tag: shift.siteTag ?? shift.roleTag ?? "",
                          });
                          setEditStartDate(start);
                          setEditEndDate(end);
                        }}
                      >
                        <Button.Label>{isEditing ? "Close" : "Edit"}</Button.Label>
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onPress={() =>
                          Alert.alert("Delete shift?", "This cannot be undone.", [
                            { text: "Cancel", style: "cancel" },
                            {
                              text: "Delete",
                              style: "destructive",
                              onPress: () =>
                                deleteShift.mutate({ shiftId: shift.shiftId }),
                            },
                          ])
                        }
                      >
                        <Button.Label>Delete</Button.Label>
                      </Button>
                    </View>
                  </View>
                  {isEditing && (
                    <View className="mt-4 gap-3 border-t border-muted pt-3">
                      <View className="gap-2">
                        <Text className="text-xs font-medium text-muted">Start</Text>
                        <Button variant="secondary" onPress={() => openEditPicker("start")}>
                          <Button.Label>
                            {editStartDate ? formatDateTime(editStartDate) : "Pick start"}
                          </Button.Label>
                        </Button>
                      </View>
                      <View className="gap-2">
                        <Text className="text-xs font-medium text-muted">End</Text>
                        <Button variant="secondary" onPress={() => openEditPicker("end")}>
                          <Button.Label>
                            {editEndDate ? formatDateTime(editEndDate) : "Pick end"}
                          </Button.Label>
                        </Button>
                      </View>
                      <TextField>
                        <TextField.Label>Unpaid break (mins)</TextField.Label>
                        <TextField.Input
                          value={editForm.breakMinutes}
                          onChangeText={(value) =>
                            setEditForm((prev) => ({ ...prev, breakMinutes: value }))
                          }
                          keyboardType="number-pad"
                        />
                      </TextField>
                      <TextField>
                        <TextField.Label>Role or site</TextField.Label>
                        <TextField.Input
                          value={editForm.tag}
                          onChangeText={(value) =>
                            setEditForm((prev) => ({ ...prev, tag: value }))
                          }
                        />
                      </TextField>
                      <View className="flex-row justify-end gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onPress={() => setEditShiftId(null)}
                        >
                          <Button.Label>Cancel</Button.Label>
                        </Button>
                        <Button
                          size="sm"
                          onPress={() => {
                            if (!editStartDate || !editEndDate) {
                              Alert.alert(
                                "Invalid time",
                                "Pick both start and end times.",
                              );
                              return;
                            }
                            const breakMinutes = Number(editForm.breakMinutes || 0);
                            updateShift.mutate({
                              shiftId: shift.shiftId,
                              patch: {
                                startUtc: editStartDate.toISOString(),
                                endUtc: editEndDate.toISOString(),
                                breaks:
                                  breakMinutes > 0
                                    ? [{ minutes: breakMinutes, paid: false }]
                                    : [],
                                siteTag: editForm.tag || null,
                              },
                            });
                          }}
                        >
                          <Button.Label>Save</Button.Label>
                        </Button>
                      </View>
                      <RNModal
                        visible={Boolean(editPicker)}
                        animationType="slide"
                        transparent
                        onRequestClose={() => setEditPicker(null)}
                      >
                        <View className="flex-1 justify-end bg-black/30">
                          <View className="rounded-t-3xl border border-muted bg-background p-5">
                            <Card.Title className="mb-2">
                              {editPicker?.field === "start"
                                ? "Select start"
                                : "Select end"}
                            </Card.Title>
                            {editPicker && (
                              <DateTimePicker
                                value={
                                  editPicker.field === "start"
                                    ? editStartDate ?? new Date()
                                    : editEndDate ?? new Date()
                                }
                                mode={editPicker.mode}
                                display={Platform.OS === "ios" ? "spinner" : "default"}
                                onChange={(event, selected) =>
                                  handleEditPickerChange(
                                    editPicker.field,
                                    editPicker.mode,
                                    event,
                                    selected,
                                  )
                                }
                              />
                            )}
                            <View className="flex-row justify-end gap-2 mt-3">
                              <Button
                                variant="secondary"
                                onPress={() => setEditPicker(null)}
                              >
                                <Button.Label>Close</Button.Label>
                              </Button>
                              {Platform.OS === "ios" && (
                                <Button onPress={() => setEditPicker(null)}>
                                  <Button.Label>Done</Button.Label>
                                </Button>
                              )}
                            </View>
                          </View>
                        </View>
                      </RNModal>
                    </View>
                  )}
                </Card>
              );
            })
          ) : (
            <Card variant="secondary" className="rounded-2xl p-4">
              <Text className="text-sm text-muted">
                {selectedJobId ? "No shifts yet." : "Select a job to see shifts."}
              </Text>
            </Card>
          )}
        </View>
      </View>
    </Container>
  );
}
