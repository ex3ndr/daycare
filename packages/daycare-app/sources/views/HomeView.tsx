import { Octicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as React from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
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
import { ItemList } from "@/components/ItemList";
import { useAgentsStore } from "@/modules/agents/agentsContext";
import type { AgentListItem } from "@/modules/agents/agentsTypes";
import { useAuthStore } from "@/modules/auth/authContext";
import { useFragmentsStore } from "@/modules/fragments/fragmentsContext";
import type { FragmentListItem } from "@/modules/fragments/fragmentsTypes";
import { useWorkspace } from "@/modules/workspaces/workspaceProvider";

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

function RecentFragmentsBox({
    fragments,
    loading,
    error,
    workspaceId,
    theme
}: {
    fragments: FragmentListItem[];
    loading: boolean;
    error: string | null;
    workspaceId: string | null;
    theme: ReturnType<typeof useUnistyles>["theme"];
}) {
    const router = useRouter();
    const recentFragments = React.useMemo(
        () => [...fragments].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 6),
        [fragments]
    );

    return (
        <Card variant="filled" size="md" style={styles.recentFragmentsBox}>
            <View style={styles.recentFragmentsHeader}>
                <Text style={[styles.boxLabel, { color: theme.colors.onSurfaceVariant }]}>RECENT FRAGMENTS</Text>
                <Octicons name="note" size={14} color={theme.colors.onSurfaceVariant} />
            </View>
            {loading && recentFragments.length === 0 ? (
                <View style={styles.centeredState}>
                    <ActivityIndicator color={theme.colors.primary} />
                </View>
            ) : error && recentFragments.length === 0 ? (
                <Text style={[styles.emptyText, { color: theme.colors.error }]}>{error}</Text>
            ) : recentFragments.length === 0 ? (
                <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>No fragments yet</Text>
            ) : (
                <View style={styles.recentFragmentsList}>
                    {recentFragments.map((fragment, index) => (
                        <Pressable
                            key={fragment.id}
                            style={[
                                styles.fragmentRow,
                                index > 0 && { borderTopWidth: 1, borderTopColor: theme.colors.outlineVariant }
                            ]}
                            disabled={!workspaceId}
                            onPress={() => {
                                if (!workspaceId) {
                                    return;
                                }
                                router.push(`/${workspaceId}/fragment/${fragment.id}`);
                            }}
                        >
                            <View style={styles.fragmentRowTop}>
                                <Text
                                    style={[styles.fragmentTitle, { color: theme.colors.onSurface }]}
                                    numberOfLines={1}
                                >
                                    {fragment.title}
                                </Text>
                                <Text style={[styles.fragmentTime, { color: theme.colors.onSurfaceVariant }]}>
                                    {timeFormat(fragment.updatedAt)}
                                </Text>
                            </View>
                            {fragment.description ? (
                                <Text
                                    style={[styles.fragmentDescription, { color: theme.colors.onSurfaceVariant }]}
                                    numberOfLines={2}
                                >
                                    {fragment.description}
                                </Text>
                            ) : null}
                            <Text style={[styles.fragmentMeta, { color: theme.colors.tertiary }]}>
                                v{fragment.version} · kit {fragment.kitVersion}
                            </Text>
                        </Pressable>
                    ))}
                </View>
            )}
        </Card>
    );
}

// --- Main view ---

/**
 * Home dashboard with the primary agent, live neural log, and recent fragments.
 */
export function HomeView() {
    const { theme } = useUnistyles();
    const baseUrl = useAuthStore((s) => s.baseUrl);
    const token = useAuthStore((s) => s.token);
    const { workspaceId } = useWorkspace();
    const agents = useAgentsStore((s) => s.agents);
    const fragments = useFragmentsStore((s) => s.fragments);
    const fragmentsError = useFragmentsStore((s) => s.error);
    const fragmentsLoading = useFragmentsStore((s) => s.loading);
    const fetchFragments = useFragmentsStore((s) => s.fetch);

    const primaryAgent = React.useMemo(
        () => agents.find((a) => a.lifecycle === "active") ?? agents[0] ?? null,
        [agents]
    );

    React.useEffect(() => {
        if (baseUrl && token) {
            void fetchFragments(baseUrl, token, workspaceId);
        }
    }, [baseUrl, token, workspaceId, fetchFragments]);

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

    // Live clock for the neural log header.
    const [clock, setClock] = React.useState(() => new Date().toLocaleTimeString());
    React.useEffect(() => {
        const id = setInterval(() => {
            setClock(new Date().toLocaleTimeString());
        }, 1_000);
        return () => clearInterval(id);
    }, []);

    return (
        <ItemList containerStyle={styles.listContent}>
            <View style={styles.topGrid}>
                <AgentBox agent={primaryAgent} actionText={AGENT_ACTIONS[actionIdx]} theme={theme} />
                <NeuralLogBox lines={thoughtLines} clock={clock} theme={theme} />
            </View>
            <RecentFragmentsBox
                fragments={fragments}
                loading={fragmentsLoading}
                error={fragmentsError}
                workspaceId={workspaceId}
                theme={theme}
            />
        </ItemList>
    );
}

// --- Styles ---

const styles = StyleSheet.create({
    listContent: {
        padding: 12,
        gap: 12
    },
    topGrid: {
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

    // Recent fragments
    recentFragmentsBox: { width: "100%", minHeight: 260 },
    recentFragmentsHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 8
    },
    recentFragmentsList: { gap: 0 },
    fragmentRow: { paddingVertical: 14, gap: 4 },
    fragmentRowTop: { flexDirection: "row", alignItems: "center", gap: 12 },
    fragmentTitle: { flex: 1, fontFamily: "IBMPlexSans-SemiBold", fontSize: 16, lineHeight: 20 },
    fragmentTime: { fontFamily: "monospace", fontSize: 11, lineHeight: 18 },
    fragmentDescription: { fontFamily: "IBMPlexSans-Regular", fontSize: 14, lineHeight: 20 },
    fragmentMeta: { fontFamily: "monospace", fontSize: 11, lineHeight: 18 },
    centeredState: { minHeight: 180, alignItems: "center", justifyContent: "center" },

    // Shared
    boxLabel: { fontFamily: "IBMPlexSans-SemiBold", fontSize: 11, letterSpacing: 1, textTransform: "uppercase" },
    liveDot: { width: 6, height: 6, borderRadius: 3 },
    emptyText: { fontFamily: "IBMPlexSans-Regular", fontSize: 13, fontStyle: "italic" }
});
