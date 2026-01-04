import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { Card, Chip, Button } from "heroui-native";
import { router } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { useEffect, useMemo, useState } from "react";

import { Container } from "@/components/container";
import { orpc } from "@/utils/orpc";

export default function Home() {
  const [selectedJobId, setSelectedJobId] = useState<string>("");

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

  const jobQuery = useQuery(
    orpc.job.get.queryOptions({
      input: { jobId: selectedJobId },
      enabled: Boolean(selectedJobId),
    }),
  );

  const payPeriodQuery = useQuery(
    orpc.payPeriod.current.queryOptions({
      input: { jobId: selectedJobId },
      enabled: Boolean(selectedJobId),
    }),
  );

  const payPeriodRangeInput = useMemo(() => {
    if (!payPeriodQuery.data) return null;
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

  const weeklyRangeInput = useMemo(() => {
    if (!selectedJobId) return null;
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - 7 * 5);
    return {
      jobId: selectedJobId,
      fromUtc: from.toISOString(),
      toUtc: to.toISOString(),
      bucket: "week" as const,
    };
  }, [selectedJobId]);

  const weeklyRangeQuery = useQuery(
    orpc.summary.range.queryOptions({
      input: weeklyRangeInput ?? {
        jobId: selectedJobId,
        fromUtc: new Date().toISOString(),
        toUtc: new Date().toISOString(),
        bucket: "week",
      },
      enabled: Boolean(weeklyRangeInput),
    }),
  );

  const weeklyBuckets = weeklyRangeQuery.data?.buckets ?? [];
  const maxWeeklyMinutes = weeklyBuckets.reduce(
    (max, item) => Math.max(max, item.totalMinutes),
    1,
  );

  const formatMinutes = (minutes?: number | null) => {
    if (minutes === undefined || minutes === null) return "—";
    const hours = Math.floor(minutes / 60);
    const remaining = minutes % 60;
    return `${hours}h ${remaining}m`;
  };

  const formatMoney = (amountMinor?: number, currency?: string) => {
    if (amountMinor === undefined) return "—";
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency ?? "GBP",
      maximumFractionDigits: 2,
    }).format(amountMinor / 100);
  };

  const formatDateRange = (start?: string, end?: string) => {
    if (!start || !end) return "—";
    const formatter = new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
    });
    return `${formatter.format(new Date(start))} → ${formatter.format(new Date(end))}`;
  };

  return (
    <Container className="p-6">
      <View className="gap-6">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-xs text-muted">Welcome back</Text>
            <Text className="text-2xl font-semibold text-foreground">
              Your overview
            </Text>
          </View>
          <Button
            size="sm"
            variant="secondary"
            onPress={() => {
              if (!selectedJobId) {
                router.push("/(drawer)/(tabs)/profile");
                return;
              }
              router.push({ pathname: "/modal", params: { jobId: selectedJobId } });
            }}
          >
            <Button.Label>Log shift</Button.Label>
          </Button>
        </View>
        <Text className="text-sm text-muted">
          Pay period anchored to 4th of the month.
        </Text>

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
              <Text className="text-sm text-muted">
                No jobs yet. Add a job in Profile to get started.
              </Text>
              <Button
                className="mt-3"
                size="sm"
                onPress={() => router.push("/(drawer)/(tabs)/profile")}
              >
                <Button.Label>Open profile</Button.Label>
              </Button>
            </Card>
          )}
        </View>

        <Card variant="secondary" className="rounded-2xl border border-primary/10 bg-primary/10 p-5">
          <View className="flex-row items-center justify-between mb-3">
            <Card.Title>Current pay period</Card.Title>
            <Chip size="sm" variant="secondary">
              <Chip.Label>In progress</Chip.Label>
            </Chip>
          </View>
          <Text className="text-lg font-semibold text-foreground">
            {formatDateRange(
              payPeriodQuery.data?.periodStartUtc,
              payPeriodQuery.data?.periodEndUtc,
            )}
          </Text>
          <Text className="text-sm text-muted mt-1">
            {formatMinutes(summaryQuery.data?.totalMinutes)} logged
          </Text>
        </Card>

        <View className="gap-4">
          <Card variant="secondary" className="rounded-2xl p-5">
            <Card.Title className="mb-2">Projected earnings</Card.Title>
            <Text className="text-3xl font-semibold text-foreground">
              {formatMoney(
                summaryQuery.data?.projectedEarnings.amount,
                summaryQuery.data?.projectedEarnings.currency,
              )}
            </Text>
            <Text className="text-sm text-muted">Overtime included</Text>
          </Card>
          <Card variant="secondary" className="rounded-2xl p-5">
            <Card.Title className="mb-2">Overtime hours</Card.Title>
            <Text className="text-3xl font-semibold text-foreground">
              {formatMinutes(summaryQuery.data?.overtimeMinutes)}
            </Text>
            <Text className="text-sm text-muted">
              {jobQuery.data?.overtimeRule
                ? `${jobQuery.data.overtimeRule.multiplier ?? 1.5}x multiplier`
                : "No overtime rule"}
            </Text>
          </Card>
          <Card variant="secondary" className="rounded-2xl p-5">
            <Card.Title className="mb-2">Month-to-date</Card.Title>
            <Text className="text-3xl font-semibold text-foreground">
              {formatMinutes(monthSummaryQuery.data?.totalMinutes)} ·{" "}
              {formatMoney(
                monthSummaryQuery.data?.grossEarnings.amount,
                monthSummaryQuery.data?.grossEarnings.currency,
              )}
            </Text>
            <Text className="text-sm text-muted">Current month totals</Text>
          </Card>
        </View>

        <Card variant="secondary" className="rounded-2xl p-5">
          <View className="flex-row items-center justify-between mb-3">
            <Card.Title>Weekly hours trend</Card.Title>
            <Text className="text-xs text-muted">Base + overtime</Text>
          </View>
          {weeklyBuckets.length ? (
            <View className="flex-row items-end justify-between gap-3">
              {weeklyBuckets.map((bucket) => {
                const overtimeMinutes = bucket.overtimeMinutes ?? 0;
                const baseMinutes = Math.max(0, bucket.totalMinutes - overtimeMinutes);
                const baseHeight = Math.max(
                  18,
                  Math.round((baseMinutes / maxWeeklyMinutes) * 140),
                );
                const overtimeHeight = Math.max(
                  8,
                  Math.round((overtimeMinutes / maxWeeklyMinutes) * 140),
                );
                return (
                  <View key={bucket.startUtc} className="items-center gap-2">
                    <View className="w-5 items-center justify-end">
                      <LinearGradient
                        colors={["#2563EB", "#6366F1", "#06B6D4"]}
                        start={{ x: 0.5, y: 0 }}
                        end={{ x: 0.5, y: 1 }}
                        style={{
                          height: baseHeight,
                          width: 16,
                          borderBottomLeftRadius: 999,
                          borderBottomRightRadius: 999,
                        }}
                      />
                      {overtimeMinutes > 0 && (
                        <LinearGradient
                          colors={["#06B6D4", "#6366F1", "#2563EB"]}
                          start={{ x: 0.5, y: 0 }}
                          end={{ x: 0.5, y: 1 }}
                          style={{
                            height: overtimeHeight,
                            width: 16,
                            borderTopLeftRadius: 999,
                            borderTopRightRadius: 999,
                            marginTop: -4,
                          }}
                        />
                      )}
                    </View>
                    <Text className="text-[10px] text-muted">
                      {new Intl.DateTimeFormat("en-GB", {
                        day: "2-digit",
                        month: "short",
                      }).format(new Date(bucket.startUtc))}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text className="text-sm text-muted">No weekly data yet.</Text>
          )}
          <View className="flex-row items-center gap-4 mt-4">
            <View className="flex-row items-center gap-2">
              <View className="h-2 w-2 rounded-full bg-[#2563EB]" />
              <Text className="text-xs text-muted">Base hours</Text>
            </View>
            <View className="flex-row items-center gap-2">
              <View className="h-2 w-2 rounded-full bg-[#06B6D4]" />
              <Text className="text-xs text-muted">Overtime</Text>
            </View>
          </View>
        </Card>
      </View>
    </Container>
  );
}
