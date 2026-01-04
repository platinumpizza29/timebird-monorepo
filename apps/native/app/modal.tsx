import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Button, Card, TextField } from "heroui-native";
import { Alert, Modal as RNModal, Platform, ScrollView, Text, View } from "react-native";
import { useEffect, useState } from "react";

import { Container } from "@/components/container";
import { orpc } from "@/utils/orpc";

function createDefaultDates() {
  const start = new Date();
  const end = new Date(start.getTime() + 4 * 60 * 60 * 1000);
  return { start, end };
}

function Modal() {
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ jobId?: string }>();
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [form, setForm] = useState({
    breakMinutes: "",
    tag: "",
  });
  const [startDate, setStartDate] = useState<Date>(() => createDefaultDates().start);
  const [endDate, setEndDate] = useState<Date>(() => createDefaultDates().end);
  const [picker, setPicker] = useState<{
    field: "start" | "end";
    mode: "date" | "time" | "datetime";
  } | null>(null);
  const [androidTempDate, setAndroidTempDate] = useState<Date | null>(null);

  const jobListQuery = useQuery(
    orpc.job.list.queryOptions({
      input: { limit: 20, activeOnly: true },
    }),
  );

  useEffect(() => {
    if (params.jobId) {
      setSelectedJobId(params.jobId);
      return;
    }
    if (!selectedJobId && jobListQuery.data?.items?.length) {
      setSelectedJobId(jobListQuery.data.items[0].jobId);
    }
  }, [jobListQuery.data?.items, params.jobId, selectedJobId]);

  const createShift = useMutation(
    orpc.shift.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries();
        router.back();
      },
      onError: (error) => {
        Alert.alert("Shift not saved", error.message || "Something went wrong.");
      },
    }),
  );

  const formatDateTime = (date: Date) =>
    new Intl.DateTimeFormat("en-GB", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);

  const openPicker = (field: "start" | "end") => {
    if (Platform.OS === "android") {
      setAndroidTempDate(field === "start" ? startDate : endDate);
      setPicker({ field, mode: "date" });
      return;
    }
    setPicker({ field, mode: "datetime" });
  };

  const handlePickerChange = (
    field: "start" | "end",
    mode: "date" | "time" | "datetime",
    event: { type?: string },
    selected?: Date,
  ) => {
    if (event.type === "dismissed") {
      setPicker(null);
      return;
    }
    if (!selected) return;

    if (Platform.OS === "android") {
      if (mode === "date") {
        setAndroidTempDate(selected);
        setPicker({ field, mode: "time" });
        return;
      }
      const base = androidTempDate ?? (field === "start" ? startDate : endDate);
      const updated = new Date(base);
      updated.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
      if (field === "start") {
        setStartDate(updated);
      } else {
        setEndDate(updated);
      }
      setPicker(null);
      return;
    }

    if (field === "start") {
      setStartDate(selected);
    } else {
      setEndDate(selected);
    }
  };

  return (
    <Container className="p-6">
      <View className="gap-6">
        <View>
          <Text className="text-2xl font-semibold text-foreground">Log shift</Text>
          <Text className="text-sm text-muted mt-1">
            Add a shift with breaks and tags.
          </Text>
        </View>

        <Card variant="secondary" className="rounded-2xl p-5">
          <Card.Title className="mb-3">Job</Card.Title>
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
            <Text className="text-sm text-muted">No jobs yet.</Text>
          )}
        </Card>

        <Card variant="secondary" className="rounded-2xl p-5">
          <Card.Title className="mb-3">Shift details</Card.Title>
          <View className="gap-3">
            <View className="gap-2">
              <Text className="text-xs font-medium text-muted">Start</Text>
              <Button variant="secondary" onPress={() => openPicker("start")}>
                <Button.Label>{formatDateTime(startDate)}</Button.Label>
              </Button>
            </View>
            <View className="gap-2">
              <Text className="text-xs font-medium text-muted">End</Text>
              <Button variant="secondary" onPress={() => openPicker("end")}>
                <Button.Label>{formatDateTime(endDate)}</Button.Label>
              </Button>
            </View>
            <TextField>
              <TextField.Label>Unpaid break (mins)</TextField.Label>
              <TextField.Input
                value={form.breakMinutes}
                onChangeText={(value) =>
                  setForm((prev) => ({ ...prev, breakMinutes: value }))
                }
                placeholder="30"
                keyboardType="number-pad"
              />
            </TextField>
            <TextField>
              <TextField.Label>Role or site</TextField.Label>
              <TextField.Input
                value={form.tag}
                onChangeText={(value) => setForm((prev) => ({ ...prev, tag: value }))}
                placeholder="Site A"
              />
            </TextField>
            <View className="flex-row gap-2">
              <Button variant="secondary" onPress={() => router.back()}>
                <Button.Label>Cancel</Button.Label>
              </Button>
              <Button
                onPress={() => {
                  if (!selectedJobId) {
                    Alert.alert("Select a job", "Choose a job before saving.");
                    return;
                  }
                  const breakMinutes = Number(form.breakMinutes || 0);
                  createShift.mutate({
                    jobId: selectedJobId,
                    startUtc: startDate.toISOString(),
                    endUtc: endDate.toISOString(),
                    breaks:
                      breakMinutes > 0 ? [{ minutes: breakMinutes, paid: false }] : [],
                    siteTag: form.tag || undefined,
                  });
                }}
              >
                <Button.Label>Save shift</Button.Label>
              </Button>
            </View>
          </View>
        </Card>
        <RNModal
          visible={Boolean(picker)}
          animationType="slide"
          transparent
          onRequestClose={() => setPicker(null)}
        >
          <View className="flex-1 justify-end bg-black/30">
            <View className="rounded-t-3xl border border-muted bg-background p-5">
              <Card.Title className="mb-3">
                {picker?.field === "start" ? "Select start" : "Select end"}
              </Card.Title>
              {picker && (
                <DateTimePicker
                  value={picker.field === "start" ? startDate : endDate}
                  mode={picker.mode}
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  onChange={(event, selected) =>
                    handlePickerChange(picker.field, picker.mode, event, selected)
                  }
                />
              )}
              <View className="flex-row justify-end gap-2 mt-4">
                <Button variant="secondary" onPress={() => setPicker(null)}>
                  <Button.Label>Close</Button.Label>
                </Button>
                {Platform.OS === "ios" && (
                  <Button onPress={() => setPicker(null)}>
                    <Button.Label>Done</Button.Label>
                  </Button>
                )}
              </View>
            </View>
          </View>
        </RNModal>
      </View>
    </Container>
  );
}

export default Modal;
