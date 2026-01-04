import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Card, TextField } from "heroui-native";
import { Alert, ScrollView, Text, View } from "react-native";
import { useEffect, useState } from "react";

import { Container } from "@/components/container";
import { useAppTheme } from "@/contexts/app-theme-context";
import { orpc } from "@/utils/orpc";

const payCycles = [
  { label: "Weekly", value: "weekly" },
  { label: "Bi-weekly", value: "bi_weekly" },
  { label: "Four-weekly", value: "four_weekly" },
  { label: "Monthly", value: "monthly" },
];

const weekdayOptions = [
  { label: "Mon", value: "1" },
  { label: "Tue", value: "2" },
  { label: "Wed", value: "3" },
  { label: "Thu", value: "4" },
  { label: "Fri", value: "5" },
  { label: "Sat", value: "6" },
  { label: "Sun", value: "0" },
];

function toDateInputValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseDateInput(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

export default function Profile() {
  const { preferredTheme, setTheme } = useAppTheme();
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
    standardBreakPaid: false,
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

  const settingsQuery = useQuery(orpc.userSettings.get.queryOptions());

  useEffect(() => {
    if (!selectedJobId && jobListQuery.data?.items?.length) {
      setSelectedJobId(jobListQuery.data.items[0].jobId);
    }
  }, [jobListQuery.data?.items, selectedJobId]);

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
      standardBreakPaid: settingsQuery.data.standardBreak?.paid ?? false,
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
        Alert.alert("Saved", "Defaults updated.");
      },
      onError: (error) => {
        Alert.alert("Save failed", error.message || "Unable to update settings.");
      },
    }),
  );

  const applyDefaults = useMutation(
    orpc.job.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries();
        Alert.alert("Applied", "Defaults applied to job.");
      },
      onError: (error) => {
        Alert.alert("Update failed", error.message || "Unable to update job.");
      },
    }),
  );

  const buildSharedPatch = () => {
    const currency = settingsQuery.data?.currency ?? "GBP";
    const hourlyRateValue = Number(form.hourlyRate);
    const hourlyRate =
      form.hourlyRate.trim() && !Number.isNaN(hourlyRateValue)
        ? { amount: Math.round(hourlyRateValue * 100), currency }
        : null;

    const contractedHoursValue = Number(form.contractedHours);
    const contractedMinutesPerWeek =
      form.contractedHours.trim() && !Number.isNaN(contractedHoursValue)
        ? Math.round(contractedHoursValue * 60)
        : null;

    const payPeriodAnchor: {
      weekday?: number;
      monthday?: number;
      startDateUtc?: string;
    } = {};

    if (form.payCycle === "monthly") {
      const monthdayValue = Number(form.monthday);
      if (!monthdayValue || monthdayValue < 1 || monthdayValue > 31) {
        Alert.alert("Missing anchor", "Enter a valid month day (1-31).");
        return null;
      }
      payPeriodAnchor.monthday = monthdayValue;
    } else {
      const weekdayValue = Number(form.weekday);
      if (Number.isNaN(weekdayValue)) {
        Alert.alert("Missing anchor", "Select a weekday.");
        return null;
      }
      payPeriodAnchor.weekday = weekdayValue;
    }

    if (form.payCycle === "bi_weekly" || form.payCycle === "four_weekly") {
      if (!form.anchorStartDate.trim()) {
        Alert.alert("Missing start date", "Set an anchor start date.");
        return null;
      }
      const parsed = parseDateInput(form.anchorStartDate);
      if (!parsed) {
        Alert.alert("Invalid start date", "Use format YYYY-MM-DD.");
        return null;
      }
      payPeriodAnchor.startDateUtc = parsed.toISOString();
    }

    const standardBreakValue = Number(form.standardBreakMinutes);
    const standardBreak =
      form.standardBreakMinutes.trim() && !Number.isNaN(standardBreakValue)
        ? { minutes: standardBreakValue, paid: form.standardBreakPaid }
        : null;

    const roundingValue = Number(form.roundingMinutes);
    const rounding =
      form.roundingMinutes.trim() && !Number.isNaN(roundingValue)
        ? {
            minutes: roundingValue,
            mode: form.roundingMode as "nearest" | "floor" | "ceil",
          }
        : null;

    const overtimeDailyValue = Number(form.overtimeDailyHours);
    const overtimeWeeklyValue = Number(form.overtimeWeeklyHours);
    const overtimeMultiplierValue = Number(form.overtimeMultiplier);
    const hasOvertime =
      form.overtimeDailyHours.trim() ||
      form.overtimeWeeklyHours.trim() ||
      form.overtimeMultiplier.trim();
    const overtimeRule = hasOvertime
      ? {
          dailyThresholdMinutes:
            form.overtimeDailyHours.trim() && !Number.isNaN(overtimeDailyValue)
              ? Math.round(overtimeDailyValue * 60)
              : undefined,
          weeklyThresholdMinutes:
            form.overtimeWeeklyHours.trim() && !Number.isNaN(overtimeWeeklyValue)
              ? Math.round(overtimeWeeklyValue * 60)
              : undefined,
          multiplier:
            form.overtimeMultiplier.trim() && !Number.isNaN(overtimeMultiplierValue)
              ? overtimeMultiplierValue
              : undefined,
        }
      : null;

    return {
      hourlyRate,
      contractedMinutesPerWeek,
      payCycle: form.payCycle,
      payPeriodAnchor,
      standardBreak,
      rounding,
      overtimeRule,
      timezone: form.timezone.trim() || "Europe/London",
    };
  };

  return (
    <Container className="p-6">
      <View className="gap-6">
        <View>
          <Text className="text-2xl font-semibold text-foreground">Profile</Text>
          <Text className="text-sm text-muted mt-1">Defaults for pay periods and rates.</Text>
        </View>

        <Card variant="secondary" className="rounded-2xl p-5">
          <Card.Title className="mb-3">Appearance</Card.Title>
          <View className="flex-row gap-2">
            {[
              { label: "Light", value: "light" },
              { label: "Dark", value: "dark" },
              { label: "System", value: "system" },
            ].map((item) => (
              <Button
                key={item.value}
                size="sm"
                variant={preferredTheme === item.value ? "primary" : "secondary"}
                onPress={() => setTheme(item.value as "light" | "dark" | "system")}
              >
                <Button.Label>{item.label}</Button.Label>
              </Button>
            ))}
          </View>
        </Card>

        <Card variant="secondary" className="rounded-2xl p-5">
          <Card.Title className="mb-3">Pay defaults</Card.Title>
          <View className="gap-3">
            <TextField>
              <TextField.Label>Hourly rate (GBP)</TextField.Label>
              <TextField.Input
                value={form.hourlyRate}
                onChangeText={(value) =>
                  setForm((prev) => ({ ...prev, hourlyRate: value }))
                }
                placeholder="12.50"
                keyboardType="decimal-pad"
              />
            </TextField>
            <TextField>
              <TextField.Label>Contracted hours/week</TextField.Label>
              <TextField.Input
                value={form.contractedHours}
                onChangeText={(value) =>
                  setForm((prev) => ({ ...prev, contractedHours: value }))
                }
                placeholder="40"
                keyboardType="number-pad"
              />
            </TextField>
            <View className="gap-2">
              <Text className="text-xs font-medium text-muted">Pay cycle</Text>
              <View className="flex-row flex-wrap gap-2">
                {payCycles.map((item) => (
                  <Button
                    key={item.value}
                    size="sm"
                    variant={form.payCycle === item.value ? "primary" : "secondary"}
                    onPress={() =>
                      setForm((prev) => ({ ...prev, payCycle: item.value }))
                    }
                  >
                    <Button.Label>{item.label}</Button.Label>
                  </Button>
                ))}
              </View>
            </View>
            {form.payCycle === "monthly" ? (
              <TextField>
                <TextField.Label>Anchor day (month)</TextField.Label>
                <TextField.Input
                  value={form.monthday}
                  onChangeText={(value) =>
                    setForm((prev) => ({ ...prev, monthday: value }))
                  }
                  placeholder="4"
                  keyboardType="number-pad"
                />
              </TextField>
            ) : (
              <View className="gap-2">
                <Text className="text-xs font-medium text-muted">Anchor weekday</Text>
                <View className="flex-row flex-wrap gap-2">
                  {weekdayOptions.map((item) => (
                    <Button
                      key={item.value}
                      size="sm"
                      variant={form.weekday === item.value ? "primary" : "secondary"}
                      onPress={() =>
                        setForm((prev) => ({ ...prev, weekday: item.value }))
                      }
                    >
                      <Button.Label>{item.label}</Button.Label>
                    </Button>
                  ))}
                </View>
              </View>
            )}
            {(form.payCycle === "bi_weekly" || form.payCycle === "four_weekly") && (
              <TextField>
                <TextField.Label>Anchor start date (YYYY-MM-DD)</TextField.Label>
                <TextField.Input
                  value={form.anchorStartDate}
                  onChangeText={(value) =>
                    setForm((prev) => ({ ...prev, anchorStartDate: value }))
                  }
                  placeholder="2025-01-04"
                />
              </TextField>
            )}
            <TextField>
              <TextField.Label>Timezone</TextField.Label>
              <TextField.Input
                value={form.timezone}
                onChangeText={(value) =>
                  setForm((prev) => ({ ...prev, timezone: value }))
                }
                placeholder="Europe/London"
              />
            </TextField>
            <Button
              className="mt-2"
              onPress={() => {
                const sharedPatch = buildSharedPatch();
                if (!sharedPatch) return;
                updateSettings.mutate({
                  patch: {
                    ...sharedPatch,
                    currency: settingsQuery.data?.currency ?? "GBP",
                  },
                });
              }}
            >
              <Button.Label>Save defaults</Button.Label>
            </Button>
          </View>
        </Card>

        <Card variant="secondary" className="rounded-2xl p-5">
          <Card.Title className="mb-3">Work preferences</Card.Title>
          <View className="gap-3">
            <TextField>
              <TextField.Label>Standard break (mins)</TextField.Label>
              <TextField.Input
                value={form.standardBreakMinutes}
                onChangeText={(value) =>
                  setForm((prev) => ({ ...prev, standardBreakMinutes: value }))
                }
                placeholder="30"
                keyboardType="number-pad"
              />
            </TextField>
            <View className="flex-row gap-2">
              <Button
                size="sm"
                variant={form.standardBreakPaid ? "primary" : "secondary"}
                onPress={() => setForm((prev) => ({ ...prev, standardBreakPaid: true }))}
              >
                <Button.Label>Paid</Button.Label>
              </Button>
              <Button
                size="sm"
                variant={!form.standardBreakPaid ? "primary" : "secondary"}
                onPress={() => setForm((prev) => ({ ...prev, standardBreakPaid: false }))}
              >
                <Button.Label>Unpaid</Button.Label>
              </Button>
            </View>
            <TextField>
              <TextField.Label>Rounding minutes</TextField.Label>
              <TextField.Input
                value={form.roundingMinutes}
                onChangeText={(value) =>
                  setForm((prev) => ({ ...prev, roundingMinutes: value }))
                }
                placeholder="15"
                keyboardType="number-pad"
              />
            </TextField>
            <View className="flex-row gap-2">
              {[
                { label: "Nearest", value: "nearest" },
                { label: "Floor", value: "floor" },
                { label: "Ceil", value: "ceil" },
              ].map((item) => (
                <Button
                  key={item.value}
                  size="sm"
                  variant={form.roundingMode === item.value ? "primary" : "secondary"}
                  onPress={() =>
                    setForm((prev) => ({ ...prev, roundingMode: item.value }))
                  }
                >
                  <Button.Label>{item.label}</Button.Label>
                </Button>
              ))}
            </View>
            <TextField>
              <TextField.Label>Overtime daily threshold (hours)</TextField.Label>
              <TextField.Input
                value={form.overtimeDailyHours}
                onChangeText={(value) =>
                  setForm((prev) => ({ ...prev, overtimeDailyHours: value }))
                }
                placeholder="8"
                keyboardType="decimal-pad"
              />
            </TextField>
            <TextField>
              <TextField.Label>Overtime weekly threshold (hours)</TextField.Label>
              <TextField.Input
                value={form.overtimeWeeklyHours}
                onChangeText={(value) =>
                  setForm((prev) => ({ ...prev, overtimeWeeklyHours: value }))
                }
                placeholder="40"
                keyboardType="decimal-pad"
              />
            </TextField>
            <TextField>
              <TextField.Label>Overtime multiplier</TextField.Label>
              <TextField.Input
                value={form.overtimeMultiplier}
                onChangeText={(value) =>
                  setForm((prev) => ({ ...prev, overtimeMultiplier: value }))
                }
                placeholder="1.5"
                keyboardType="decimal-pad"
              />
            </TextField>
          </View>
        </Card>

        <Card variant="secondary" className="rounded-2xl p-5">
          <Card.Title className="mb-3">Apply to job</Card.Title>
          <View className="gap-3">
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
              <Text className="text-sm text-muted">No jobs available yet.</Text>
            )}
            <Button
              variant="secondary"
              onPress={() => {
                if (!selectedJobId) {
                  Alert.alert("Select a job", "Choose a job to apply defaults.");
                  return;
                }
                const sharedPatch = buildSharedPatch();
                if (!sharedPatch) return;
                applyDefaults.mutate({
                  jobId: selectedJobId,
                  patch: {
                    hourlyRate: sharedPatch.hourlyRate ?? undefined,
                    contractedMinutesPerWeek: sharedPatch.contractedMinutesPerWeek,
                    payCycle: sharedPatch.payCycle,
                    payPeriodAnchor: sharedPatch.payPeriodAnchor,
                    standardBreak: sharedPatch.standardBreak,
                    rounding: sharedPatch.rounding,
                    overtimeRule: sharedPatch.overtimeRule,
                    timezone: sharedPatch.timezone,
                  },
                });
              }}
            >
              <Button.Label>Apply defaults to job</Button.Label>
            </Button>
          </View>
        </Card>
      </View>
    </Container>
  );
}
