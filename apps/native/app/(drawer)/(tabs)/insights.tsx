import { useQuery } from "@tanstack/react-query";
import { Button, Card, Chip } from "heroui-native";
import { ScrollView, Text, View } from "react-native";
import { useEffect, useMemo, useState } from "react";

import { Container } from "@/components/container";
import { orpc } from "@/utils/orpc";

export default function Insights() {
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

  const rangeInput = useMemo(() => {
    if (!selectedJobId) return null;
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - 7 * 7);
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

  const chartData = rangeSummaryQuery.data?.buckets ?? [];
  const maxMinutes =
    chartData.length > 0
      ? Math.max(...chartData.map((item) => item.totalMinutes))
      : 1;

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

  return (
    <Container className="p-6">
      <View className="gap-6">
        <View>
          <Text className="text-2xl font-semibold text-foreground">Insights</Text>
          <Text className="text-sm text-muted mt-1">
            Weekly hours and overtime trends.
          </Text>
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

        <Card variant="secondary" className="rounded-2xl p-5">
          <View className="flex-row items-center justify-between mb-4">
            <Card.Title>Weekly Hours</Card.Title>
            <Chip size="sm" variant="secondary">
              <Chip.Label>Last 7 weeks</Chip.Label>
            </Chip>
          </View>
          {chartData.length ? (
            <View className="flex-row items-end justify-between h-36">
              {chartData.map((bucket) => {
                const height = Math.max(
                  20,
                  Math.round((bucket.totalMinutes / maxMinutes) * 120),
                );
                return (
                  <View key={bucket.startUtc} className="items-center gap-2">
                    <View className="w-5 rounded-lg bg-primary/80" style={{ height }} />
                    <Text className="text-[10px] text-muted">
                      {new Intl.DateTimeFormat("en-GB", {
                        month: "short",
                        day: "2-digit",
                      }).format(new Date(bucket.startUtc))}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text className="text-sm text-muted">No data yet.</Text>
          )}
        </Card>

        <View className="gap-4">
          <Card variant="secondary" className="rounded-2xl p-5">
            <Card.Title className="mb-2">Overtime</Card.Title>
            <Text className="text-3xl font-semibold text-foreground">
              {formatMinutes(monthSummaryQuery.data?.overtimeMinutes)}
            </Text>
            <Text className="text-sm text-muted">
              {jobQuery.data?.overtimeRule
                ? `${jobQuery.data.overtimeRule.multiplier ?? 1.5}x multiplier`
                : "No overtime rule"}
            </Text>
          </Card>
          <Card variant="secondary" className="rounded-2xl p-5">
            <Card.Title className="mb-2">Gross this month</Card.Title>
            <Text className="text-3xl font-semibold text-foreground">
              {formatMoney(
                monthSummaryQuery.data?.grossEarnings.amount,
                monthSummaryQuery.data?.grossEarnings.currency,
              )}
            </Text>
            <Text className="text-sm text-muted">Month-to-date totals</Text>
          </Card>
        </View>
      </View>
    </Container>
  );
}
