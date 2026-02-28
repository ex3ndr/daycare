import { useCallback, useEffect, useMemo, useRef } from "react";
import { ScrollView, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

// Block states matching classic defrag visualization
type BlockState = "running" | "queued" | "complete" | "error" | "idle" | "writing";

const BLOCK_SIZE = 14;
const BLOCK_GAP = 2;
const COLS = 24;
const TOTAL_BLOCKS = COLS * 18;

// Color palette for each state
const stateColors: Record<BlockState, string> = {
    running: "#4caf50",
    queued: "#ffb74d",
    complete: "#1565c0",
    error: "#ef5350",
    idle: "#37474f",
    writing: "#7c4dff"
};

const stateLabels: Record<BlockState, string> = {
    running: "Running",
    queued: "Queued",
    complete: "Complete",
    error: "Error",
    idle: "Free",
    writing: "Writing"
};

// Generate a seeded block map for each agent
function generateBlocks(seed: number, profile: Record<BlockState, number>): BlockState[] {
    const blocks: BlockState[] = [];
    for (const [state, count] of Object.entries(profile) as [BlockState, number][]) {
        for (let i = 0; i < count; i++) blocks.push(state);
    }
    // Fill remaining with idle
    while (blocks.length < TOTAL_BLOCKS) blocks.push("idle");
    // Seeded shuffle
    let s = seed;
    for (let i = blocks.length - 1; i > 0; i--) {
        s = ((s * 1103515245 + 12345) & 0x7fffffff) >>> 0;
        const j = s % (i + 1);
        [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
    }
    return blocks;
}

const agents = [
    {
        name: "Scout",
        role: "General research assistant",
        status: "running" as const,
        blocks: generateBlocks(42, { running: 68, queued: 24, complete: 180, error: 2, idle: 0, writing: 12 })
    },
    {
        name: "Builder",
        role: "Code generation and refactoring",
        status: "running" as const,
        blocks: generateBlocks(77, { running: 45, queued: 38, complete: 120, error: 0, idle: 0, writing: 30 })
    },
    {
        name: "Operator",
        role: "Infrastructure and deployment ops",
        status: "error" as const,
        blocks: generateBlocks(13, { running: 8, queued: 0, complete: 90, error: 32, idle: 0, writing: 0 })
    },
    {
        name: "Reviewer",
        role: "Code review and quality checks",
        status: "idle" as const,
        blocks: generateBlocks(99, { running: 0, queued: 0, complete: 210, error: 4, idle: 0, writing: 0 })
    },
    {
        name: "Scheduler",
        role: "Task planning and prioritization",
        status: "queued" as const,
        blocks: generateBlocks(55, { running: 0, queued: 56, complete: 140, error: 0, idle: 0, writing: 8 })
    },
    {
        name: "Monitor",
        role: "System health and alerting",
        status: "idle" as const,
        blocks: generateBlocks(31, { running: 0, queued: 0, complete: 280, error: 8, idle: 0, writing: 0 })
    }
];

// Animated scanning cursor that sweeps across the grid
function ScanCursor({ active }: { active: boolean }) {
    const { theme } = useUnistyles();
    const position = useSharedValue(0);

    useEffect(() => {
        if (active) {
            position.value = 0;
            position.value = withRepeat(
                withTiming(COLS * (BLOCK_SIZE + BLOCK_GAP), { duration: 3000 }),
                -1,
                false
            );
        }
    }, [active, position]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: position.value }]
    }));

    if (!active) return null;

    return (
        <Animated.View
            style={[
                {
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: 2,
                    height: "100%",
                    backgroundColor: theme.colors.primary,
                    opacity: 0.6,
                    zIndex: 1
                },
                animatedStyle
            ]}
        />
    );
}

// Single animated block that pulses when in active state
function Block({ state, animate }: { state: BlockState; animate: boolean }) {
    const opacity = useSharedValue(1);

    useEffect(() => {
        if (animate && (state === "running" || state === "writing")) {
            opacity.value = withRepeat(
                withSequence(
                    withTiming(0.4, { duration: 600 }),
                    withTiming(1, { duration: 600 })
                ),
                -1,
                true
            );
        }
    }, [animate, state, opacity]);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value
    }));

    return (
        <Animated.View
            style={[
                gridStyles.block,
                { backgroundColor: stateColors[state] },
                animatedStyle
            ]}
        />
    );
}

// Grid for a single agent
function AgentGrid({ agent }: { agent: (typeof agents)[number] }) {
    const { theme } = useUnistyles();
    const isActive = agent.status === "running" || agent.status === "error";

    // Count blocks by state for the summary
    const counts = useMemo(() => {
        const c: Partial<Record<BlockState, number>> = {};
        for (const b of agent.blocks) {
            c[b] = (c[b] || 0) + 1;
        }
        return c;
    }, [agent.blocks]);

    return (
        <View style={[gridStyles.agentCard, { backgroundColor: theme.colors.surfaceContainer }]}>
            {/* Header */}
            <View style={gridStyles.agentHeader}>
                <View style={gridStyles.agentInfo}>
                    <View style={gridStyles.agentNameRow}>
                        <View style={[gridStyles.statusDot, { backgroundColor: stateColors[agent.status] }]} />
                        <Text style={[gridStyles.agentName, { color: theme.colors.onSurface }]}>
                            {agent.name}
                        </Text>
                    </View>
                    <Text style={[gridStyles.agentRole, { color: theme.colors.onSurfaceVariant }]}>
                        {agent.role}
                    </Text>
                </View>
                <View style={gridStyles.statsRow}>
                    {(["running", "queued", "complete", "error"] as BlockState[]).map((s) =>
                        counts[s] ? (
                            <View key={s} style={gridStyles.statItem}>
                                <View style={[gridStyles.statDot, { backgroundColor: stateColors[s] }]} />
                                <Text style={[gridStyles.statText, { color: theme.colors.onSurfaceVariant }]}>
                                    {counts[s]}
                                </Text>
                            </View>
                        ) : null
                    )}
                </View>
            </View>

            {/* Defrag grid */}
            <View style={[gridStyles.gridContainer, { backgroundColor: theme.colors.surface }]}>
                <ScanCursor active={isActive} />
                <View style={gridStyles.grid}>
                    {agent.blocks.map((state, i) => (
                        <Block key={i} state={state} animate={isActive} />
                    ))}
                </View>
            </View>
        </View>
    );
}

// Legend bar
function Legend() {
    const { theme } = useUnistyles();
    return (
        <View style={[gridStyles.legend, { backgroundColor: theme.colors.surfaceContainer }]}>
            {(Object.entries(stateLabels) as [BlockState, string][]).map(([state, label]) => (
                <View key={state} style={gridStyles.legendItem}>
                    <View style={[gridStyles.legendDot, { backgroundColor: stateColors[state] }]} />
                    <Text style={[gridStyles.legendText, { color: theme.colors.onSurfaceVariant }]}>{label}</Text>
                </View>
            ))}
        </View>
    );
}

export function AgentsView() {
    return (
        <ScrollView contentContainerStyle={gridStyles.container}>
            <Legend />
            {agents.map((agent) => (
                <AgentGrid key={agent.name} agent={agent} />
            ))}
        </ScrollView>
    );
}

const gridStyles = StyleSheet.create((theme) => ({
    container: {
        padding: 16,
        gap: 12
    },
    legend: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 12,
        padding: 12,
        borderRadius: 10
    },
    legendItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6
    },
    legendDot: {
        width: 10,
        height: 10,
        borderRadius: 2
    },
    legendText: {
        fontSize: 12,
        fontFamily: "IBMPlexMono-Regular"
    },
    agentCard: {
        borderRadius: 10,
        overflow: "hidden"
    },
    agentHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        padding: 12,
        paddingBottom: 8
    },
    agentInfo: {
        gap: 2,
        flex: 1
    },
    agentNameRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4
    },
    agentName: {
        fontSize: 15,
        fontFamily: "IBMPlexSans-SemiBold"
    },
    agentRole: {
        fontSize: 12,
        fontFamily: "IBMPlexSans-Regular",
        marginLeft: 16
    },
    statsRow: {
        flexDirection: "row",
        gap: 10,
        alignItems: "center"
    },
    statItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4
    },
    statDot: {
        width: 6,
        height: 6,
        borderRadius: 1
    },
    statText: {
        fontSize: 11,
        fontFamily: "IBMPlexMono-Regular"
    },
    gridContainer: {
        margin: 12,
        marginTop: 4,
        padding: 6,
        borderRadius: 6,
        overflow: "hidden",
        position: "relative"
    },
    grid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: BLOCK_GAP
    },
    block: {
        width: BLOCK_SIZE,
        height: BLOCK_SIZE,
        borderRadius: 2
    }
}));
