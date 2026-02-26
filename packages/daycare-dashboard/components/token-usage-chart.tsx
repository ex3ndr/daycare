"use client";

import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import { Database, DollarSign } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { TokenStatsRow } from "@/lib/engine-client";

type TokenUsageChartProps = {
  rows: TokenStatsRow[];
};

type RangeKey = "6h" | "24h" | "7d";
type MetricKey = "tokens" | "cost";

const HOUR_MS = 60 * 60 * 1000;
const RANGE_MS: Record<RangeKey, number> = {
  "6h": 6 * HOUR_MS,
  "24h": 24 * HOUR_MS,
  "7d": 7 * 24 * HOUR_MS
};

export function TokenUsageChart({ rows }: TokenUsageChartProps) {
  const [range, setRange] = useState<RangeKey>("24h");
  const [metric, setMetric] = useState<MetricKey>("tokens");
  const [userFilter, setUserFilter] = useState<string>("all");
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [modelFilter, setModelFilter] = useState<string>("all");

  const now = Date.now();
  const from = now - RANGE_MS[range];
  const startHour = hourFloor(from);
  const endHour = hourFloor(now);

  const rangedRows = useMemo(
    () => rows.filter((row) => row.hourStart >= startHour && row.hourStart <= endHour),
    [rows, startHour, endHour]
  );

  const userOptions = useMemo(() => uniqueSorted(rangedRows.map((row) => row.userId)), [rangedRows]);
  const agentOptions = useMemo(
    () =>
      uniqueSorted(
        rangedRows
          .filter((row) => userFilter === "all" || row.userId === userFilter)
          .map((row) => row.agentId)
      ),
    [rangedRows, userFilter]
  );
  const modelOptions = useMemo(
    () =>
      uniqueSorted(
        rangedRows
          .filter((row) => userFilter === "all" || row.userId === userFilter)
          .filter((row) => agentFilter === "all" || row.agentId === agentFilter)
          .map((row) => row.model)
      ),
    [rangedRows, userFilter, agentFilter]
  );

  useEffect(() => {
    if (userFilter !== "all" && !userOptions.includes(userFilter)) {
      setUserFilter("all");
    }
  }, [userFilter, userOptions]);

  useEffect(() => {
    if (agentFilter !== "all" && !agentOptions.includes(agentFilter)) {
      setAgentFilter("all");
    }
  }, [agentFilter, agentOptions]);

  useEffect(() => {
    if (modelFilter !== "all" && !modelOptions.includes(modelFilter)) {
      setModelFilter("all");
    }
  }, [modelFilter, modelOptions]);

  const filteredRows = useMemo(
    () =>
      rangedRows
        .filter((row) => userFilter === "all" || row.userId === userFilter)
        .filter((row) => agentFilter === "all" || row.agentId === agentFilter)
        .filter((row) => modelFilter === "all" || row.model === modelFilter),
    [rangedRows, userFilter, agentFilter, modelFilter]
  );

  const summary = useMemo(() => summarizeRows(filteredRows), [filteredRows]);
  const chartData = useMemo(() => seriesBuild(filteredRows, startHour, endHour), [filteredRows, startHour, endHour]);

  const chartConfig = {
    inputTotal: {
      label: "Input (+cache read)",
      color: "hsl(var(--chart-1))"
    },
    outputTotal: {
      label: "Output (+cache write)",
      color: "hsl(var(--chart-2))"
    },
    cost: {
      label: "Cost",
      color: "hsl(var(--chart-3))"
    }
  } satisfies ChartConfig;

  return (
    <Card className="@container/card animate-in fade-in-0 slide-in-from-bottom-2">
      <CardHeader className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            {metric === "cost" ? <DollarSign className="h-5 w-5" /> : <Database className="h-5 w-5" />}
          </div>
          <div>
            <CardTitle>Token usage</CardTitle>
            <CardDescription>Hourly rollups by user, agent, and model.</CardDescription>
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-6">
          <ToggleGroup
            type="single"
            value={range}
            onValueChange={(value) => value && setRange(value as RangeKey)}
            variant="outline"
            className="justify-start xl:col-span-2"
          >
            <ToggleGroupItem value="6h" className="h-8 px-2.5">6h</ToggleGroupItem>
            <ToggleGroupItem value="24h" className="h-8 px-2.5">24h</ToggleGroupItem>
            <ToggleGroupItem value="7d" className="h-8 px-2.5">7d</ToggleGroupItem>
          </ToggleGroup>

          <ToggleGroup
            type="single"
            value={metric}
            onValueChange={(value) => value && setMetric(value as MetricKey)}
            variant="outline"
            className="justify-start"
          >
            <ToggleGroupItem value="tokens" className="h-8 px-2.5">Tokens</ToggleGroupItem>
            <ToggleGroupItem value="cost" className="h-8 px-2.5">Cost</ToggleGroupItem>
          </ToggleGroup>

          <Select value={userFilter} onValueChange={setUserFilter}>
            <SelectTrigger aria-label="Filter user">
              <SelectValue placeholder="All users" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All users</SelectItem>
              {userOptions.map((userId) => (
                <SelectItem key={userId} value={userId}>{userId}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={agentFilter} onValueChange={setAgentFilter}>
            <SelectTrigger aria-label="Filter agent">
              <SelectValue placeholder="All agents" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All agents</SelectItem>
              {agentOptions.map((agentId) => (
                <SelectItem key={agentId} value={agentId}>{agentId}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={modelFilter} onValueChange={setModelFilter}>
            <SelectTrigger aria-label="Filter model">
              <SelectValue placeholder="All models" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All models</SelectItem>
              {modelOptions.map((model) => (
                <SelectItem key={model} value={model}>{model}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 px-2 pt-0 sm:px-6">
        <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border bg-background/60 px-3 py-2">
            Input total: <span className="font-semibold text-foreground">{formatInteger(summary.inputTotal)}</span>
          </div>
          <div className="rounded-lg border bg-background/60 px-3 py-2">
            Output total: <span className="font-semibold text-foreground">{formatInteger(summary.outputTotal)}</span>
          </div>
          <div className="rounded-lg border bg-background/60 px-3 py-2">
            Cache read/write: <span className="font-semibold text-foreground">{formatInteger(summary.cacheRead + summary.cacheWrite)}</span>
          </div>
          <div className="rounded-lg border bg-background/60 px-3 py-2">
            Cost: <span className="font-semibold text-foreground">${summary.cost.toFixed(4)}</span>
          </div>
        </div>

        <ChartContainer config={chartConfig} className="aspect-auto h-[260px] w-full">
          <AreaChart data={chartData} margin={{ left: 8, right: 8 }}>
            <defs>
              <linearGradient id="fillTokenInput" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-inputTotal)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-inputTotal)" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="fillTokenOutput" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-outputTotal)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-outputTotal)" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="fillTokenCost" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-cost)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-cost)" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="timestamp"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={24}
              tickFormatter={(value) => xAxisLabelFormat(value, range)}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent labelFormatter={(value) => shortDateFormat(value)} indicator="dot" />}
            />
            {metric === "tokens" ? (
              <>
                <Area
                  dataKey="inputTotal"
                  type="natural"
                  fill="url(#fillTokenInput)"
                  stroke="var(--color-inputTotal)"
                  stackId="a"
                />
                <Area
                  dataKey="outputTotal"
                  type="natural"
                  fill="url(#fillTokenOutput)"
                  stroke="var(--color-outputTotal)"
                  stackId="a"
                />
              </>
            ) : (
              <Area
                dataKey="cost"
                type="natural"
                fill="url(#fillTokenCost)"
                stroke="var(--color-cost)"
              />
            )}
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

type SeriesPoint = {
  timestamp: string;
  inputTotal: number;
  outputTotal: number;
  cacheRead: number;
  cacheWrite: number;
  cost: number;
};

function seriesBuild(rows: TokenStatsRow[], startHour: number, endHour: number): SeriesPoint[] {
  const buckets = new Map<number, Omit<SeriesPoint, "timestamp">>();
  for (const row of rows) {
    const inputTotal = row.input + row.cacheRead;
    const outputTotal = row.output + row.cacheWrite;
    const existing = buckets.get(row.hourStart) ?? {
      inputTotal: 0,
      outputTotal: 0,
      cacheRead: 0,
      cacheWrite: 0,
      cost: 0
    };
    existing.inputTotal += inputTotal;
    existing.outputTotal += outputTotal;
    existing.cacheRead += row.cacheRead;
    existing.cacheWrite += row.cacheWrite;
    existing.cost += row.cost;
    buckets.set(row.hourStart, existing);
  }

  const points: SeriesPoint[] = [];
  for (let hour = startHour; hour <= endHour; hour += HOUR_MS) {
    const bucket = buckets.get(hour) ?? {
      inputTotal: 0,
      outputTotal: 0,
      cacheRead: 0,
      cacheWrite: 0,
      cost: 0
    };
    points.push({
      timestamp: new Date(hour).toISOString(),
      ...bucket
    });
  }
  return points;
}

function summarizeRows(rows: TokenStatsRow[]) {
  const summary = rows.reduce(
    (acc, row) => {
      acc.input += row.input;
      acc.output += row.output;
      acc.cacheRead += row.cacheRead;
      acc.cacheWrite += row.cacheWrite;
      acc.cost += row.cost;
      return acc;
    },
    { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, inputTotal: 0, outputTotal: 0 }
  );
  summary.inputTotal = summary.input + summary.cacheRead;
  summary.outputTotal = summary.output + summary.cacheWrite;
  return summary;
}

function hourFloor(value: number): number {
  return Math.floor(value / HOUR_MS) * HOUR_MS;
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function xAxisLabelFormat(value: string | number, range: RangeKey): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  if (range === "7d") {
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function shortDateFormat(value: string | number) {
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

function formatInteger(value: number): string {
  return Math.max(0, Math.trunc(value)).toLocaleString("en-US");
}
