import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/")({
  component: HomeComponent,
});

// Marketing-style landing page with a live API health check.
function HomeComponent() {
  const healthCheck = useQuery(orpc.healthCheck.queryOptions());
  const apiStatus = healthCheck.isLoading
    ? "Checking..."
    : healthCheck.data
      ? "Connected"
      : "Disconnected";

  return (
    <div className="min-h-svh bg-background">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 py-10">
        <section className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">
              Time Bird
            </p>
            <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
              The shift tracker built for real workdays.
            </h1>
            <p className="text-base text-muted-foreground">
              Log hours fast, see pay period totals instantly, and stay ahead of overtime
              without spreadsheets.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button>Get started</Button>
              <Button variant="outline">View dashboard</Button>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              API status: {apiStatus}
            </div>
          </div>
          <Card>
            <CardHeader className="border-b">
              <CardTitle>This week at a glance</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 pt-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Pay period</span>
                <span className="text-sm font-medium">04 Jan → 03 Feb</span>
              </div>
              <div className="grid gap-2 rounded-none border p-3">
                <p className="text-xs text-muted-foreground">Projected earnings</p>
                <p className="text-xl font-semibold">£1,620</p>
                <p className="text-xs text-muted-foreground">Overtime tracked automatically</p>
              </div>
              <div className="grid gap-2 rounded-none border p-3">
                <p className="text-xs text-muted-foreground">Hours logged</p>
                <p className="text-xl font-semibold">32h 15m</p>
                <p className="text-xs text-muted-foreground">3 shifts completed</p>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6">
          <div className="flex items-end justify-between">
            <h2 className="text-2xl font-semibold">Features</h2>
            <span className="text-xs text-muted-foreground">
              Built for UK pay cycles
            </span>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                title: "Shift logging",
                text: "Clock in and out with break rules and auto‑rounding.",
              },
              {
                title: "Pay period clarity",
                text: "Deterministic pay cycles with anchors you can change anytime.",
              },
              {
                title: "Overtime insight",
                text: "Daily and weekly thresholds with multipliers you control.",
              },
            ].map((feature) => (
              <Card key={feature.title}>
                <CardHeader className="border-b">
                  <CardTitle>{feature.title}</CardTitle>
                </CardHeader>
                <CardContent className="pt-4 text-sm text-muted-foreground">
                  {feature.text}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <h2 className="text-2xl font-semibold">Timeline</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              A simple flow from setup to payday.
            </p>
          </div>
          <div className="space-y-4">
            {[
              {
                step: "Set your pay cycle",
                detail: "Pick monthly, bi‑weekly, or weekly with an anchor date.",
              },
              {
                step: "Log shifts",
                detail: "Add breaks, tags, and notes. Payable hours update instantly.",
              },
              {
                step: "Review totals",
                detail: "See current period earnings and month‑to‑date totals.",
              },
              {
                step: "Export",
                detail: "Download CSVs for payroll or personal records.",
              },
            ].map((item, index) => (
              <div key={item.step} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border text-xs">
                    {index + 1}
                  </div>
                  {index < 3 && <div className="h-full w-px bg-border" />}
                </div>
                <div className="pb-4">
                  <p className="text-sm font-medium">{item.step}</p>
                  <p className="text-sm text-muted-foreground">{item.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Contact me</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="grid gap-2">
                <label className="text-xs font-medium">Name</label>
                <Input placeholder="Your name" />
              </div>
              <div className="grid gap-2">
                <label className="text-xs font-medium">Email</label>
                <Input type="email" placeholder="you@email.com" />
              </div>
              <div className="grid gap-2">
                <label className="text-xs font-medium">Message</label>
                <textarea
                  className="border-border bg-background text-foreground min-h-28 rounded-none border px-2 py-2 text-sm"
                  placeholder="Tell me about your team and pay cycle."
                />
              </div>
              <Button>Send message</Button>
            </CardContent>
          </Card>
          <div className="space-y-4">
            <Card>
              <CardHeader className="border-b">
                <CardTitle>Need something custom?</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 text-sm text-muted-foreground">
                I can tailor Time Bird for specific roles, sites, or payroll providers.
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="border-b">
                <CardTitle>API Status</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center gap-2 pt-4 text-sm text-muted-foreground">
                <span
                  className={`h-2 w-2 rounded-full ${
                    healthCheck.data ? "bg-emerald-400" : "bg-red-400"
                  }`}
                />
                {apiStatus}
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </div>
  );
}
