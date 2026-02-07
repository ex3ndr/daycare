"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Filter,
  Globe,
  Monitor,
  Plus,
  Radio,
  RefreshCw,
  Send,
  Server,
  Zap
} from "lucide-react";

import { DashboardShell } from "@/components/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { fetchSignalEvents, generateSignal, type SignalEvent, type SignalSource } from "@/lib/engine-client";

export default function SignalsPage() {
  const [events, setEvents] = useState<SignalEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [typeFilter, setTypeFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const sseRef = useRef<EventSource | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSignalEvents(500);
      setEvents(data);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load signals");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // SSE for real-time signal updates
  useEffect(() => {
    const source = new EventSource("/api/v1/engine/events");
    sseRef.current = source;

    source.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as { type: string; payload?: SignalEvent };
        if (parsed.type === "signal.generated" && parsed.payload) {
          setEvents((prev) => [...prev, parsed.payload as SignalEvent]);
        }
      } catch {
        // ignore malformed SSE data
      }
    };

    return () => {
      source.close();
    };
  }, []);

  // Derived: unique signal types
  const signalTypes = useMemo(() => {
    const types = new Set(events.map((e) => e.type));
    return Array.from(types).sort();
  }, [events]);

  // Derived: unique source types
  const sourceTypes = useMemo(() => {
    const types = new Set(events.map((e) => e.source.type));
    return Array.from(types).sort();
  }, [events]);

  // Filtered events
  const filtered = useMemo(() => {
    let result = events;
    if (typeFilter) {
      const lower = typeFilter.toLowerCase();
      result = result.filter((e) => e.type.toLowerCase().includes(lower));
    }
    if (sourceFilter !== "all") {
      result = result.filter((e) => e.source.type === sourceFilter);
    }
    return result;
  }, [events, typeFilter, sourceFilter]);

  // Reverse chronological for display
  const sorted = useMemo(() => [...filtered].reverse(), [filtered]);

  // Stats
  const last5Min = useMemo(() => {
    const cutoff = Date.now() - 5 * 60_000;
    return events.filter((e) => e.createdAt > cutoff).length;
  }, [events]);

  const lastHour = useMemo(() => {
    const cutoff = Date.now() - 60 * 60_000;
    return events.filter((e) => e.createdAt > cutoff).length;
  }, [events]);

  return (
    <DashboardShell
      title="Signals"
      subtitle="Event stream from agents, system, webhooks, and processes."
      toolbar={
        <Button onClick={() => void refresh()} disabled={loading} className="gap-2">
          <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          Refresh
        </Button>
      }
      status={
        <>
          <span>{lastUpdated ? `Last synced ${lastUpdated.toLocaleTimeString()}` : "Awaiting first sync"}</span>
          {error ? (
            <span className="rounded-full border border-destructive/40 bg-destructive/10 px-2.5 py-1 text-destructive">
              {error}
            </span>
          ) : (
            <span>{events.length} events loaded</span>
          )}
        </>
      }
    >
      <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total events"
            value={events.length}
            detail="Signals persisted"
            icon={<Radio className="h-5 w-5" />}
            tone="primary"
          />
          <StatCard
            label="Last 5 min"
            value={last5Min}
            detail="Recent activity"
            icon={<Zap className="h-5 w-5" />}
            tone="amber"
          />
          <StatCard
            label="Last hour"
            value={lastHour}
            detail="Hourly throughput"
            icon={<Clock className="h-5 w-5" />}
            tone="emerald"
          />
          <StatCard
            label="Signal types"
            value={signalTypes.length}
            detail={signalTypes.length ? signalTypes.slice(0, 3).join(", ") : "No types yet"}
            icon={<Filter className="h-5 w-5" />}
            tone="violet"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Filter className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Filter by signal type..."
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue placeholder="All sources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              {sourceTypes.map((type) => (
                <SelectItem key={type} value={type}>{type}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">
            {filtered.length === events.length
              ? `${events.length} events`
              : `${filtered.length} of ${events.length} events`}
          </span>
        </div>

        {/* Send signal */}
        <SendSignalForm />

        {/* Event timeline */}
        {sorted.length ? (
          <div className="space-y-2">
            {sorted.map((event) => (
              <SignalEventCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted/50">
                <Radio className="h-8 w-8" />
              </div>
              <span className="text-sm">
                {events.length === 0 ? "No signals recorded yet" : "No signals match your filters"}
              </span>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardShell>
  );
}

/* ── Signal event card ────────────────────────────────────────────────── */

function SignalEventCard({ event }: { event: SignalEvent }) {
  const [expanded, setExpanded] = useState(false);
  const hasData = event.data !== undefined && event.data !== null;

  return (
    <Card className="transition-shadow hover:shadow-md">
      <div
        className="flex items-start gap-3 px-4 py-3 cursor-pointer select-none"
        onClick={() => hasData && setExpanded((prev) => !prev)}
      >
        {/* Source icon */}
        <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${sourceStyle(event.source).bg}`}>
          <SourceIcon source={event.source} className={`h-3.5 w-3.5 ${sourceStyle(event.source).text}`} />
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm font-medium text-foreground">{event.type}</span>
            <Badge variant="outline" className="text-[10px] gap-1">
              <SourceIcon source={event.source} className="h-2.5 w-2.5" />
              {formatSource(event.source)}
            </Badge>
            {hasData && (
              <Badge variant="secondary" className="text-[10px]">payload</Badge>
            )}
          </div>
          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
            <span>{formatRelativeTime(event.createdAt)}</span>
            <span className="font-mono text-[10px] opacity-60">{event.id}</span>
          </div>
        </div>

        {/* Expand icon */}
        {hasData && (
          <button className="mt-1 shrink-0 rounded p-1 text-muted-foreground hover:bg-muted">
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        )}
      </div>

      {expanded && hasData && (
        <div className="border-t px-4 py-3">
          <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Data payload
          </div>
          <pre className="max-h-64 overflow-auto rounded-lg border bg-muted/50 p-3 text-xs font-mono text-foreground whitespace-pre-wrap break-words">
            {formatPayload(event.data)}
          </pre>
        </div>
      )}
    </Card>
  );
}

/* ── Send signal form ─────────────────────────────────────────────────── */

function SendSignalForm() {
  const [open, setOpen] = useState(false);
  const [signalType, setSignalType] = useState("");
  const [sourceType, setSourceType] = useState<string>("system");
  const [sourceId, setSourceId] = useState("");
  const [dataText, setDataText] = useState("");
  const [dataError, setDataError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState(false);

  // Validate JSON as user types
  const validateData = (text: string) => {
    setDataText(text);
    setSendError(null);
    setSendSuccess(false);
    if (!text.trim()) {
      setDataError(null);
      return;
    }
    try {
      JSON.parse(text);
      setDataError(null);
    } catch (err) {
      setDataError(err instanceof Error ? err.message : "Invalid JSON");
    }
  };

  const handleSend = async () => {
    setSendError(null);
    setSendSuccess(false);

    if (!signalType.trim()) {
      setSendError("Signal type is required");
      return;
    }

    // Build source
    let source: SignalSource | undefined;
    if (sourceType === "system") {
      source = { type: "system" };
    } else if (sourceType === "agent") {
      if (!sourceId.trim()) {
        setSendError("Agent ID is required");
        return;
      }
      source = { type: "agent", id: sourceId.trim() };
    } else if (sourceType === "webhook") {
      source = { type: "webhook", id: sourceId.trim() || undefined };
    } else if (sourceType === "process") {
      source = { type: "process", id: sourceId.trim() || undefined };
    }

    // Parse data if provided
    let data: unknown;
    if (dataText.trim()) {
      try {
        data = JSON.parse(dataText);
      } catch {
        setSendError("Data must be valid JSON");
        return;
      }
    }

    setSending(true);
    try {
      await generateSignal({ type: signalType.trim(), source, data });
      setSendSuccess(true);
      setSignalType("");
      setDataText("");
      setSourceId("");
      setDataError(null);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Failed to send signal");
    } finally {
      setSending(false);
    }
  };

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)} className="gap-2 self-start">
        <Plus className="h-3.5 w-3.5" />
        Send signal
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Send className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base">Send signal</CardTitle>
              <CardDescription>Generate a new signal event.</CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)} className="text-xs">
            Cancel
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Type */}
        <div className="space-y-1.5">
          <Label htmlFor="signal-type" className="text-xs">Signal type *</Label>
          <Input
            id="signal-type"
            placeholder="e.g. build.completed, deploy.started"
            value={signalType}
            onChange={(e) => { setSignalType(e.target.value); setSendError(null); setSendSuccess(false); }}
            className="h-9 font-mono"
          />
        </div>

        {/* Source */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Source type</Label>
            <Select value={sourceType} onValueChange={(v) => { setSourceType(v); setSendError(null); }}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="system">system</SelectItem>
                <SelectItem value="agent">agent</SelectItem>
                <SelectItem value="webhook">webhook</SelectItem>
                <SelectItem value="process">process</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {sourceType !== "system" && (
            <div className="space-y-1.5">
              <Label htmlFor="source-id" className="text-xs">
                Source ID {sourceType === "agent" ? "*" : "(optional)"}
              </Label>
              <Input
                id="source-id"
                placeholder={sourceType === "agent" ? "agent-id" : "optional-id"}
                value={sourceId}
                onChange={(e) => { setSourceId(e.target.value); setSendError(null); }}
                className="h-9 font-mono"
              />
            </div>
          )}
        </div>

        {/* Data payload */}
        <div className="space-y-1.5">
          <Label htmlFor="signal-data" className="text-xs">
            Data payload (JSON, optional)
          </Label>
          <div className="relative">
            <textarea
              id="signal-data"
              placeholder='{"key": "value"}'
              value={dataText}
              onChange={(e) => validateData(e.target.value)}
              rows={4}
              className={`w-full rounded-lg border bg-background px-3 py-2 font-mono text-xs leading-relaxed text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y ${
                dataError ? "border-destructive focus-visible:ring-destructive" : ""
              }`}
            />
            {dataText.trim() && !dataError && (
              <div className="absolute right-2 top-2">
                <Check className="h-3.5 w-3.5 text-emerald-500" />
              </div>
            )}
          </div>
          {dataError && (
            <div className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertCircle className="h-3 w-3 shrink-0" />
              <span className="truncate">{dataError}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button onClick={() => void handleSend()} disabled={sending || !!dataError} className="gap-2">
            <Send className={`h-3.5 w-3.5 ${sending ? "animate-pulse" : ""}`} />
            {sending ? "Sending..." : "Send signal"}
          </Button>
          {sendError && (
            <span className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertCircle className="h-3 w-3 shrink-0" />
              {sendError}
            </span>
          )}
          {sendSuccess && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
              <Check className="h-3 w-3" />
              Signal sent
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Stat card ────────────────────────────────────────────────────────── */

type StatCardProps = {
  label: string;
  value: number;
  detail: string;
  icon: React.ReactNode;
  tone: "primary" | "amber" | "emerald" | "violet";
};

const toneMap: Record<StatCardProps["tone"], { bg: string; text: string; gradient: string }> = {
  primary: { bg: "bg-primary/10", text: "text-primary", gradient: "from-primary/10 via-card to-card" },
  amber: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", gradient: "from-amber-500/10 via-card to-card" },
  emerald: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", gradient: "from-emerald-500/10 via-card to-card" },
  violet: { bg: "bg-violet-500/10", text: "text-violet-600 dark:text-violet-400", gradient: "from-violet-500/10 via-card to-card" }
};

function StatCard({ label, value, detail, icon, tone }: StatCardProps) {
  const t = toneMap[tone];
  return (
    <Card className="relative overflow-hidden">
      <div className={`absolute inset-0 bg-gradient-to-br ${t.gradient}`} />
      <CardHeader className="relative flex flex-row items-center justify-between pb-2">
        <div>
          <CardDescription className="text-xs">{label}</CardDescription>
          <CardTitle className="text-3xl font-semibold tabular-nums">{value}</CardTitle>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-full ${t.bg} ${t.text}`}>
          {icon}
        </div>
      </CardHeader>
      <CardContent className="relative text-xs text-muted-foreground truncate">{detail}</CardContent>
    </Card>
  );
}

/* ── Source helpers ────────────────────────────────────────────────────── */

function SourceIcon({ source, className }: { source: SignalSource; className?: string }) {
  switch (source.type) {
    case "system": return <Server className={className} />;
    case "agent": return <Bot className={className} />;
    case "webhook": return <Globe className={className} />;
    case "process": return <Monitor className={className} />;
  }
}

function sourceStyle(source: SignalSource) {
  switch (source.type) {
    case "system": return { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400" };
    case "agent": return { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400" };
    case "webhook": return { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400" };
    case "process": return { bg: "bg-violet-500/10", text: "text-violet-600 dark:text-violet-400" };
  }
}

function formatSource(source: SignalSource): string {
  switch (source.type) {
    case "system": return "system";
    case "agent": return `agent:${source.id}`;
    case "webhook": return source.id ? `webhook:${source.id}` : "webhook";
    case "process": return source.id ? `process:${source.id}` : "process";
  }
}

/* ── Formatters ───────────────────────────────────────────────────────── */

function formatRelativeTime(ts: number): string {
  const diffMs = Date.now() - ts;
  if (diffMs < 0) return "just now";
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d ago`;
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatPayload(data: unknown): string {
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
}
