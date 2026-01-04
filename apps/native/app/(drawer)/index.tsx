import { Button, Card, Chip } from "heroui-native";
import { router } from "expo-router";
import { Text, View } from "react-native";
import { useEffect } from "react";

import { Container } from "@/components/container";
import { SignIn } from "@/components/sign-in";
import { SignUp } from "@/components/sign-up";
import { authClient } from "@/lib/auth-client";

export default function Onboarding() {
  const { data: session } = authClient.useSession();
  const isLoggedIn = Boolean(session?.user);

  useEffect(() => {
    if (isLoggedIn) {
      router.replace("/(drawer)/(tabs)");
    }
  }, [isLoggedIn]);

  if (isLoggedIn) {
    return (
      <Container className="p-6">
        <View className="gap-4">
          <Text className="text-sm text-muted">Loading your dashboard...</Text>
        </View>
      </Container>
    );
  }

  return (
    <Container className="p-6">
      <View className="gap-8">
        <View className="gap-3">
          <Text className="text-sm uppercase tracking-[3px] text-muted">
            Time Bird
          </Text>
          <Text className="text-3xl font-semibold text-foreground">
            The shift tracker built for real workdays.
          </Text>
          <Text className="text-sm text-muted">
            Log shifts fast, track overtime, and see pay period totals without
            spreadsheets.
          </Text>
          {session?.user ? (
            <Button
              className="self-start mt-2"
              onPress={() => router.push("/(drawer)/(tabs)")}
            >
              <Button.Label>Go to app</Button.Label>
            </Button>
          ) : (
            <Button className="self-start mt-2">
              <Button.Label>Create account</Button.Label>
            </Button>
          )}
        </View>

        <Card variant="secondary" className="rounded-2xl p-5">
          <Card.Title className="mb-3">Why teams choose Time Bird</Card.Title>
          <View className="gap-3">
            {[
              "Fast shift logging with break rules",
              "Monthly, bi-weekly, or weekly pay periods",
              "Overtime multipliers you control",
            ].map((item) => (
              <View key={item} className="flex-row items-center gap-2">
                <View className="h-2 w-2 rounded-full bg-primary" />
                <Text className="text-sm text-foreground">{item}</Text>
              </View>
            ))}
          </View>
        </Card>

        <Card variant="secondary" className="rounded-2xl p-5">
          <View className="flex-row items-center justify-between mb-3">
            <Card.Title>Setup steps</Card.Title>
            <Chip size="sm" variant="secondary">
              <Chip.Label>3 mins</Chip.Label>
            </Chip>
          </View>
          <View className="gap-4">
            {[
              { step: "Add your job", detail: "Hourly rate, pay cycle, breaks." },
              { step: "Log your first shift", detail: "Start/end, breaks, tag." },
              { step: "Track the period", detail: "See projected earnings." },
            ].map((item, index) => (
              <View key={item.step} className="flex-row gap-3">
                <View className="h-7 w-7 rounded-full border border-muted items-center justify-center">
                  <Text className="text-xs text-muted">{index + 1}</Text>
                </View>
                <View>
                  <Text className="text-sm font-medium text-foreground">{item.step}</Text>
                  <Text className="text-xs text-muted">{item.detail}</Text>
                </View>
              </View>
            ))}
          </View>
        </Card>

        {!session?.user && (
          <View className="gap-4">
            <SignIn />
            <SignUp />
          </View>
        )}
      </View>
    </Container>
  );
}
