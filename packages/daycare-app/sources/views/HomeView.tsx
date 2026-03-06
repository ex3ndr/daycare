import { Octicons } from "@expo/vector-icons";
import * as React from "react";
import { ScrollView, Text, View } from "react-native";
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withRepeat,
    withSequence,
    withTiming
} from "react-native-reanimated";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { Card } from "@/components/Card";
import { HtmlView } from "@/components/HtmlView";
import { useAgentsStore } from "@/modules/agents/agentsContext";
import type { AgentListItem } from "@/modules/agents/agentsTypes";
import { useObservationsStore } from "@/modules/observations/observationsContext";
import type { ObservationItem } from "@/modules/observations/observationsTypes";
import { useTasksStore } from "@/modules/tasks/tasksContext";
import type { CronTriggerSummary, TaskSummary } from "@/modules/tasks/tasksTypes";

// --- Simulated data ---

const THOUGHTS = [
    "indexing semantic memory fragments...",
    "cross-referencing task priorities...",
    "optimizing neural pathway weights...",
    "scanning incoming webhooks...",
    "consolidating short-term memory...",
    "evaluating cron schedule drift...",
    "defragmenting knowledge graph...",
    "running sentiment analysis pass...",
    "calibrating response confidence...",
    "checking connector heartbeats...",
    "compiling daily activity digest...",
    "pruning stale context windows...",
    "resolving entity references...",
    "synchronizing agent state...",
    "calculating inference latency p99...",
    "rotating attention heads...",
    "warming embedding cache...",
    "parsing upstream tool results...",
    "applying reinforcement signal...",
    "scheduling memory consolidation...",
    "testing sandbox boundaries...",
    "verifying permission scopes...",
    "analyzing conversation topology...",
    "generating summary embeddings...",
    "monitoring token budget...",
    "rebalancing priority queue...",
    "handshaking with connectors...",
    "archiving completed sessions...",
    "refreshing world model...",
    "all systems nominal :)"
];

const AGENT_ACTIONS = [
    "thinking deeply...",
    "processing requests...",
    "monitoring channels...",
    "standing by...",
    "analyzing patterns...",
    "learning new things..."
];

const THOUGHT_COUNT = 7;

function randomThought(): string {
    return THOUGHTS[Math.floor(Math.random() * THOUGHTS.length)];
}

function seedThoughts(): string[] {
    return Array.from({ length: THOUGHT_COUNT }, randomThought);
}

// --- Character HTML ---

function agentCharacterHtml(bgColor: string, fgColor: string): string {
    return `
<style>
  body { display: flex; align-items: center; justify-content: center; }
  .bot {
    width: 100%; height: 100%;
    display: flex; align-items: center; justify-content: center;
  }
  svg { width: 80%; height: 80%; }
  .eye { animation: blink 4s infinite; }
  @keyframes blink {
    0%, 90%, 100% { transform: scaleY(1); }
    95% { transform: scaleY(0.1); }
  }
  .antenna { animation: wobble 3s ease-in-out infinite; transform-origin: bottom center; }
  @keyframes wobble {
    0%, 100% { transform: rotate(0deg); }
    25% { transform: rotate(8deg); }
    75% { transform: rotate(-8deg); }
  }
  .mouth { animation: talk 2s ease-in-out infinite; }
  @keyframes talk {
    0%, 100% { d: path("M28,42 Q36,48 44,42"); }
    50% { d: path("M28,44 Q36,44 44,44"); }
  }
  .body-glow { animation: pulse 2.5s ease-in-out infinite; }
  @keyframes pulse {
    0%, 100% { opacity: 0.3; }
    50% { opacity: 0.8; }
  }
</style>
<div class="bot">
  <svg viewBox="0 0 72 72" fill="none">
    <!-- antenna -->
    <g class="antenna">
      <line x1="36" y1="12" x2="36" y2="4" stroke="${fgColor}" stroke-width="2" stroke-linecap="round"/>
      <circle cx="36" cy="3" r="2.5" fill="${fgColor}" opacity="0.8"/>
    </g>
    <!-- head -->
    <rect x="16" y="12" width="40" height="32" rx="8" fill="${bgColor}" stroke="${fgColor}" stroke-width="2"/>
    <!-- screen glow -->
    <rect class="body-glow" x="20" y="16" width="32" height="24" rx="4" fill="${fgColor}" opacity="0.3"/>
    <!-- eyes -->
    <g class="eye">
      <rect x="25" y="24" width="6" height="7" rx="2" fill="${fgColor}"/>
      <rect x="41" y="24" width="6" height="7" rx="2" fill="${fgColor}"/>
    </g>
    <!-- mouth -->
    <path class="mouth" d="M28,36 Q36,42 44,36" stroke="${fgColor}" stroke-width="2" fill="none" stroke-linecap="round"/>
    <!-- body -->
    <rect x="22" y="46" width="28" height="14" rx="4" fill="${bgColor}" stroke="${fgColor}" stroke-width="2"/>
    <!-- body lines -->
    <line x1="30" y1="50" x2="30" y2="56" stroke="${fgColor}" stroke-width="1.5" opacity="0.4"/>
    <line x1="36" y1="49" x2="36" y2="57" stroke="${fgColor}" stroke-width="1.5" opacity="0.4"/>
    <line x1="42" y1="50" x2="42" y2="56" stroke="${fgColor}" stroke-width="1.5" opacity="0.4"/>
    <!-- arms -->
    <rect x="8" y="48" width="12" height="6" rx="3" fill="${bgColor}" stroke="${fgColor}" stroke-width="1.5"/>
    <rect x="52" y="48" width="12" height="6" rx="3" fill="${bgColor}" stroke="${fgColor}" stroke-width="1.5"/>
    <!-- feet -->
    <rect x="24" y="62" width="10" height="5" rx="2.5" fill="${fgColor}" opacity="0.6"/>
    <rect x="38" y="62" width="10" height="5" rx="2.5" fill="${fgColor}" opacity="0.6"/>
  </svg>
</div>`;
}

// --- Helpers ---

function timeFormat(timestamp: number): string {
    const diff = Date.now() - timestamp;
    if (diff < 60_000) return "now";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
    return `${Math.floor(diff / 86_400_000)}d`;
}

function obsIcon(type: string): "pulse" | "alert" | "info" | "zap" {
    if (type === "error" || type === "warn") return "alert";
    if (type === "action") return "zap";
    return "info";
}

function uptimeFormat(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// --- Sub-components ---

function ThinkingDots({ color }: { color: string }) {
    const d1 = useSharedValue(0.3);
    const d2 = useSharedValue(0.3);
    const d3 = useSharedValue(0.3);

    React.useEffect(() => {
        const pulse = (duration: number) =>
            withRepeat(withSequence(withTiming(1, { duration }), withTiming(0.3, { duration })), -1);
        d1.value = pulse(500);
        d2.value = withDelay(200, pulse(500));
        d3.value = withDelay(400, pulse(500));
    }, [d1, d2, d3]);

    const s1 = useAnimatedStyle(() => ({ opacity: d1.value }));
    const s2 = useAnimatedStyle(() => ({ opacity: d2.value }));
    const s3 = useAnimatedStyle(() => ({ opacity: d3.value }));

    const dot = { width: 6, height: 6, borderRadius: 3, backgroundColor: color };

    return (
        <View style={{ flexDirection: "row", gap: 4 }}>
            <Animated.View style={[dot, s1]} />
            <Animated.View style={[dot, s2]} />
            <Animated.View style={[dot, s3]} />
        </View>
    );
}

function AgentBox({
    agent,
    actionText,
    theme
}: {
    agent: AgentListItem | null;
    actionText: string;
    theme: ReturnType<typeof useUnistyles>["theme"];
}) {
    const characterHtml = React.useMemo(
        () => agentCharacterHtml(theme.colors.primaryContainer, theme.colors.onPrimaryContainer),
        [theme.colors.primaryContainer, theme.colors.onPrimaryContainer]
    );

    return (
        <Card variant="filled" size="md" style={styles.agentBox}>
            <View style={styles.agentBoxInner}>
                <View style={[styles.characterFrame, { backgroundColor: theme.colors.primaryContainer }]}>
                    <HtmlView
                        html={characterHtml}
                        backgroundColor={theme.colors.primaryContainer}
                        style={{ width: 100, height: 100 }}
                    />
                </View>
                <View style={styles.agentMeta}>
                    <Text style={[styles.boxLabel, { color: theme.colors.onSurfaceVariant }]}>AGENT</Text>
                    <Text style={[styles.agentName, { color: theme.colors.onSurface }]} numberOfLines={1}>
                        {agent?.name ?? "Daycare"}
                    </Text>
                    <View style={styles.statusRow}>
                        <View
                            style={[
                                styles.statusDot,
                                {
                                    backgroundColor:
                                        agent?.lifecycle === "active"
                                            ? "#4CAF50"
                                            : agent?.lifecycle === "sleeping"
                                              ? "#FFC107"
                                              : "#9E9E9E"
                                }
                            ]}
                        />
                        <Text style={[styles.statusText, { color: theme.colors.onSurfaceVariant }]}>
                            {agent?.lifecycle ?? "offline"}
                        </Text>
                    </View>
                    <View style={{ marginTop: 4, flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <ThinkingDots color={theme.colors.tertiary} />
                        <Text style={[styles.actionText, { color: theme.colors.tertiary }]} numberOfLines={1}>
                            {actionText}
                        </Text>
                    </View>
                </View>
            </View>
        </Card>
    );
}

function NeuralLogBox({
    lines,
    clock,
    theme
}: {
    lines: string[];
    clock: string;
    theme: ReturnType<typeof useUnistyles>["theme"];
}) {
    return (
        <Card
            variant="filled"
            size="sm"
            style={[styles.neuralBox, { backgroundColor: theme.colors.surfaceContainerHigh }]}
        >
            <View style={styles.neuralHeader}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <View style={[styles.liveDot, { backgroundColor: "#4CAF50" }]} />
                    <Text style={[styles.boxLabel, { color: theme.colors.onSurfaceVariant }]}>NEURAL LOG</Text>
                </View>
                <Text style={[styles.clockText, { color: theme.colors.onSurfaceVariant }]}>{clock}</Text>
            </View>
            <View style={styles.neuralLines}>
                {lines.map((line, i) => (
                    <Text
                        key={`${i}-${line}`}
                        style={[
                            styles.neuralLine,
                            { color: theme.colors.tertiary, opacity: 0.3 + (i / lines.length) * 0.7 }
                        ]}
                        numberOfLines={1}
                    >
                        {">"} {line}
                    </Text>
                ))}
            </View>
        </Card>
    );
}

function ActivityFeedBox({
    observations,
    theme
}: {
    observations: ObservationItem[];
    theme: ReturnType<typeof useUnistyles>["theme"];
}) {
    const pulseDot = useSharedValue(0.4);

    React.useEffect(() => {
        pulseDot.value = withRepeat(
            withSequence(withTiming(1, { duration: 1000 }), withTiming(0.4, { duration: 1000 })),
            -1
        );
    }, [pulseDot]);

    const pulseStyle = useAnimatedStyle(() => ({ opacity: pulseDot.value }));
    const recent = observations.slice(0, 8);

    return (
        <Card variant="filled" size="sm" style={styles.feedBox}>
            <View style={styles.feedHeader}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Animated.View style={[styles.liveDot, { backgroundColor: theme.colors.error }, pulseStyle]} />
                    <Text style={[styles.boxLabel, { color: theme.colors.onSurfaceVariant }]}>LIVE FEED</Text>
                </View>
                <Octicons name="pulse" size={14} color={theme.colors.onSurfaceVariant} />
            </View>
            {recent.length === 0 ? (
                <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
                    Waiting for activity...
                </Text>
            ) : (
                <View style={styles.feedList}>
                    {recent.map((obs) => (
                        <View key={obs.id} style={styles.feedRow}>
                            <Octicons
                                name={obsIcon(obs.type)}
                                size={12}
                                color={theme.colors.onSurfaceVariant}
                                style={{ marginTop: 2 }}
                            />
                            <Text style={[styles.feedMessage, { color: theme.colors.onSurface }]} numberOfLines={1}>
                                {obs.message}
                            </Text>
                            <Text style={[styles.feedTime, { color: theme.colors.onSurfaceVariant }]}>
                                {timeFormat(obs.createdAt)}
                            </Text>
                        </View>
                    ))}
                </View>
            )}
        </Card>
    );
}

function TasksBox({
    tasks,
    cronTriggers,
    theme
}: {
    tasks: TaskSummary[];
    cronTriggers: CronTriggerSummary[];
    theme: ReturnType<typeof useUnistyles>["theme"];
}) {
    const recentlyRan = React.useMemo(
        () =>
            tasks
                .filter((t) => t.lastExecutedAt !== null)
                .sort((a, b) => (b.lastExecutedAt ?? 0) - (a.lastExecutedAt ?? 0))
                .slice(0, 3),
        [tasks]
    );

    const scheduled = React.useMemo(() => {
        const taskIds = new Set(cronTriggers.map((c) => c.taskId));
        return tasks.filter((t) => taskIds.has(t.id)).slice(0, 3);
    }, [tasks, cronTriggers]);

    const cronByTask = React.useMemo(() => {
        const map = new Map<string, string>();
        for (const c of cronTriggers) {
            if (!map.has(c.taskId)) map.set(c.taskId, c.schedule);
        }
        return map;
    }, [cronTriggers]);

    return (
        <Card variant="filled" size="sm" style={styles.tasksBox}>
            <View style={styles.feedHeader}>
                <Text style={[styles.boxLabel, { color: theme.colors.onSurfaceVariant }]}>ROUTINES</Text>
                <Octicons name="clock" size={14} color={theme.colors.onSurfaceVariant} />
            </View>
            {tasks.length === 0 ? (
                <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>No tasks yet</Text>
            ) : (
                <>
                    {recentlyRan.length > 0 && (
                        <View style={styles.taskSection}>
                            <Text style={[styles.taskSectionLabel, { color: theme.colors.onSurfaceVariant }]}>
                                RECENTLY RAN
                            </Text>
                            {recentlyRan.map((t) => (
                                <View key={t.id} style={styles.taskRow}>
                                    <Octicons
                                        name="check-circle"
                                        size={12}
                                        color={theme.colors.tertiary}
                                        style={{ marginTop: 2 }}
                                    />
                                    <Text
                                        style={[styles.taskTitle, { color: theme.colors.onSurface }]}
                                        numberOfLines={1}
                                    >
                                        {t.title}
                                    </Text>
                                    <Text style={[styles.feedTime, { color: theme.colors.onSurfaceVariant }]}>
                                        {timeFormat(t.lastExecutedAt!)}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    )}
                    {scheduled.length > 0 && (
                        <View style={styles.taskSection}>
                            <Text style={[styles.taskSectionLabel, { color: theme.colors.onSurfaceVariant }]}>
                                SCHEDULED
                            </Text>
                            {scheduled.map((t) => (
                                <View key={t.id} style={styles.taskRow}>
                                    <Octicons
                                        name="clock"
                                        size={12}
                                        color={theme.colors.onSurfaceVariant}
                                        style={{ marginTop: 2 }}
                                    />
                                    <Text
                                        style={[styles.taskTitle, { color: theme.colors.onSurface }]}
                                        numberOfLines={1}
                                    >
                                        {t.title}
                                    </Text>
                                    <Text style={[styles.taskSchedule, { color: theme.colors.tertiary }]}>
                                        {cronByTask.get(t.id) ?? ""}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    )}
                </>
            )}
        </Card>
    );
}

function SystemTicker({
    agentCount,
    eventCount,
    uptime,
    theme
}: {
    agentCount: number;
    eventCount: number;
    uptime: number;
    theme: ReturnType<typeof useUnistyles>["theme"];
}) {
    return (
        <View
            style={[
                styles.ticker,
                { backgroundColor: theme.colors.surfaceContainerHigh, borderColor: theme.colors.outlineVariant }
            ]}
        >
            <Text style={[styles.tickerText, { color: theme.colors.onSurfaceVariant }]} numberOfLines={1}>
                {agentCount} agents online {"  ·  "}
                {eventCount} events logged {"  ·  "}
                uptime: {uptimeFormat(uptime)} {"  ·  "}
                system nominal {"  ·  "}
                have a great day
            </Text>
        </View>
    );
}

// --- Main view ---

/**
 * Home dashboard — bento-box layout with agent character, neural log,
 * live activity feed, task routines, and system ticker.
 */
export function HomeView() {
    const { theme } = useUnistyles();
    const agents = useAgentsStore((s) => s.agents);
    const observations = useObservationsStore((s) => s.observations);
    const tasks = useTasksStore((s) => s.tasks);
    const triggers = useTasksStore((s) => s.triggers);

    const primaryAgent = React.useMemo(
        () => agents.find((a) => a.lifecycle === "active") ?? agents[0] ?? null,
        [agents]
    );

    // Cycling thoughts for neural log
    const [thoughtLines, setThoughtLines] = React.useState(seedThoughts);
    React.useEffect(() => {
        const id = setInterval(() => {
            setThoughtLines((prev) => [...prev.slice(1), randomThought()]);
        }, 2_500);
        return () => clearInterval(id);
    }, []);

    // Cycling agent action text
    const [actionIdx, setActionIdx] = React.useState(0);
    React.useEffect(() => {
        const id = setInterval(() => {
            setActionIdx((prev) => (prev + 1) % AGENT_ACTIONS.length);
        }, 4_000);
        return () => clearInterval(id);
    }, []);

    // Live clock for neural log header
    const [clock, setClock] = React.useState(() => new Date().toLocaleTimeString());
    const mountTime = React.useRef(Date.now());
    const [uptime, setUptime] = React.useState(0);
    React.useEffect(() => {
        const id = setInterval(() => {
            setClock(new Date().toLocaleTimeString());
            setUptime(Math.floor((Date.now() - mountTime.current) / 1000));
        }, 1_000);
        return () => clearInterval(id);
    }, []);

    return (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            <View style={styles.grid}>
                <AgentBox agent={primaryAgent} actionText={AGENT_ACTIONS[actionIdx]} theme={theme} />
                <NeuralLogBox lines={thoughtLines} clock={clock} theme={theme} />
                <ActivityFeedBox observations={observations} theme={theme} />
                <TasksBox tasks={tasks} cronTriggers={triggers.cron} theme={theme} />
            </View>
            <SystemTicker agentCount={agents.length} eventCount={observations.length} uptime={uptime} theme={theme} />
        </ScrollView>
    );
}

// --- Styles ---

const styles = StyleSheet.create({
    scroll: { flex: 1 },
    scrollContent: {
        padding: 12,
        flexGrow: 1
    },
    grid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 12
    },

    // Agent box
    agentBox: { flexGrow: 1, flexShrink: 1, flexBasis: "30%", minWidth: 220, height: 200 },
    agentBoxInner: { flexDirection: "row", gap: 14, flex: 1 },
    characterFrame: {
        width: 110,
        borderRadius: 12,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center"
    },
    agentMeta: { flex: 1, justifyContent: "center", gap: 2 },
    agentName: { fontFamily: "IBMPlexSans-SemiBold", fontSize: 18, lineHeight: 22 },
    statusRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
    statusText: { fontFamily: "IBMPlexSans-Regular", fontSize: 13, textTransform: "capitalize" },
    actionText: { fontFamily: "monospace", fontSize: 11 },

    // Neural log box
    neuralBox: { flexGrow: 2, flexShrink: 1, flexBasis: "55%", minWidth: 300, height: 200 },
    neuralHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
    neuralLines: { flex: 1, justifyContent: "flex-end", gap: 2 },
    neuralLine: { fontFamily: "monospace", fontSize: 12, lineHeight: 18 },
    clockText: { fontFamily: "monospace", fontSize: 11 },

    // Activity feed
    feedBox: { flexGrow: 2, flexShrink: 1, flexBasis: "55%", minWidth: 300, height: 280 },
    feedHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
    feedList: { flex: 1, gap: 4 },
    feedRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
    feedMessage: { flex: 1, fontFamily: "IBMPlexSans-Regular", fontSize: 13, lineHeight: 18 },
    feedTime: { fontFamily: "monospace", fontSize: 11, lineHeight: 18 },

    // Tasks box
    tasksBox: { flexGrow: 1, flexShrink: 1, flexBasis: "30%", minWidth: 260, height: 280 },
    taskSection: { marginTop: 8, gap: 4 },
    taskSectionLabel: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 10,
        letterSpacing: 1,
        textTransform: "uppercase",
        marginBottom: 2
    },
    taskRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
    taskTitle: { flex: 1, fontFamily: "IBMPlexSans-Regular", fontSize: 13, lineHeight: 18 },
    taskSchedule: { fontFamily: "monospace", fontSize: 11, lineHeight: 18 },

    // Shared
    boxLabel: { fontFamily: "IBMPlexSans-SemiBold", fontSize: 11, letterSpacing: 1, textTransform: "uppercase" },
    liveDot: { width: 6, height: 6, borderRadius: 3 },
    emptyText: { fontFamily: "IBMPlexSans-Regular", fontSize: 13, fontStyle: "italic" },

    // Ticker
    ticker: {
        marginTop: 12,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 12,
        borderWidth: 1,
        alignItems: "center"
    },
    tickerText: { fontFamily: "monospace", fontSize: 12 }
});
