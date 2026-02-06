"use client";

import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import { Activity, RefreshCw } from "lucide-react";

import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const telemetryData = {
  "1h": buildSeries(12),
  "6h": buildSeries(18),
  "24h": buildSeries(24)
};

export default function TelemetryPage() {
  const [range, setRange] = useState<"1h" | "6h" | "24h">("6h");
  const data = useMemo(() => telemetryData[range], [range]);

  const chartConfig = {
    throughput: {
      label: "Throughput",
      color: "hsl(var(--chart-1))"
    },
    latency: {
      label: "Latency",
      color: "hsl(var(--chart-2))"
    }
  } satisfies ChartConfig;

  return (
    <DashboardShell
      title="Telemetry"
      subtitle="Runtime performance, latency, and throughput snapshots."
      toolbar={
        <Button className="gap-2" onClick={() => setRange("6h")}>
          <RefreshCw className="h-4 w-4" />
          Snapshot
        </Button>
      }
      status={<span>Showing aggregate metrics for the last {range}.</span>}
    >
      <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardDescription>Avg. latency</CardDescription>
                <CardTitle className="text-2xl">120ms</CardTitle>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Activity className="h-5 w-5" />
              </div>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">Steady response times across nodes.</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Requests/min</CardDescription>
              <CardTitle className="text-2xl">4.3k</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">Current throughput for inference.</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Error rate</CardDescription>
              <CardTitle className="text-2xl">0.4%</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">Healthy error budgets remain.</CardContent>
          </Card>
        </div>

        <Card className="@container/card">
          <CardHeader className="relative">
            <CardTitle>Engine performance</CardTitle>
            <CardDescription>Request throughput vs. latency.</CardDescription>
            <div className="absolute right-4 top-4">
              <ToggleGroup
                type="single"
                value={range}
                onValueChange={(value) => value && setRange(value as "1h" | "6h" | "24h")}
                variant="outline"
                className="@[767px]/card:flex hidden"
              >
                <ToggleGroupItem value="1h" className="h-8 px-2.5">
                  1h
                </ToggleGroupItem>
                <ToggleGroupItem value="6h" className="h-8 px-2.5">
                  6h
                </ToggleGroupItem>
                <ToggleGroupItem value="24h" className="h-8 px-2.5">
                  24h
                </ToggleGroupItem>
              </ToggleGroup>
              <Select value={range} onValueChange={(value) => setRange(value as "1h" | "6h" | "24h")}>
                <SelectTrigger className="@[767px]/card:hidden flex w-28" aria-label="Select time range">
                  <SelectValue placeholder="6h" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="1h" className="rounded-lg">
                    Last 1h
                  </SelectItem>
                  <SelectItem value="6h" className="rounded-lg">
                    Last 6h
                  </SelectItem>
                  <SelectItem value="24h" className="rounded-lg">
                    Last 24h
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
            <ChartContainer config={chartConfig} className="aspect-auto h-[260px] w-full">
              <AreaChart data={data} margin={{ left: 8, right: 8 }}>
                <defs>
                  <linearGradient id="fillThroughput" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-throughput)" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="var(--color-throughput)" stopOpacity={0.1} />
                  </linearGradient>
                  <linearGradient id="fillLatency" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-latency)" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="var(--color-latency)" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="timestamp"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={24}
                  tickFormatter={(value) => new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent labelFormatter={(value) => formatShortDate(value)} indicator="dot" />}
                />
                <Area
                  dataKey="throughput"
                  type="natural"
                  fill="url(#fillThroughput)"
                  stroke="var(--color-throughput)"
                  stackId="a"
                />
                <Area
                  dataKey="latency"
                  type="natural"
                  fill="url(#fillLatency)"
                  stroke="var(--color-latency)"
                  stackId="a"
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}

function buildSeries(points: number) {
  const now = Date.now();
  const stepMs = 60 * 60 * 1000;

  return Array.from({ length: points }).map((_, index) => {
    const timestamp = new Date(now - (points - 1 - index) * stepMs).toISOString();
    return {
      timestamp,
      throughput: Math.round(3000 + Math.sin(index / 2) * 600 + index * 20),
      latency: Math.round(80 + Math.cos(index / 3) * 20 + index)
    };
  });
}

function formatShortDate(value: string | number) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}
