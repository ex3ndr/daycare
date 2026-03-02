import { Octicons } from "@expo/vector-icons";
import type * as React from "react";
import { ScrollView, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

type MissionStatus = "active" | "completed" | "upcoming";

type Mission = {
    id: string;
    title: string;
    description: string;
    status: MissionStatus;
    progress: number; // 0-1
    tasksTotal: number;
    tasksDone: number;
    dueLabel: string;
};

const MISSIONS: Mission[] = [
    {
        id: "m1",
        title: "Onboard first 10 users",
        description: "Get initial users set up with agents and verify the onboarding flow works end to end.",
        status: "completed",
        progress: 1,
        tasksTotal: 10,
        tasksDone: 10,
        dueLabel: "Completed Feb 18"
    },
    {
        id: "m2",
        title: "Launch email integration",
        description: "Ship the email connector so agents can send and receive messages on behalf of users.",
        status: "active",
        progress: 0.65,
        tasksTotal: 12,
        tasksDone: 8,
        dueLabel: "Due Mar 15"
    },
    {
        id: "m3",
        title: "Cost tracking under $200/mo",
        description: "Optimize inference costs and set up alerts to keep monthly spend below the target.",
        status: "active",
        progress: 0.4,
        tasksTotal: 8,
        tasksDone: 3,
        dueLabel: "Due Mar 30"
    },
    {
        id: "m4",
        title: "Document all agent APIs",
        description: "Write comprehensive API docs for every public agent endpoint and publish them.",
        status: "upcoming",
        progress: 0,
        tasksTotal: 15,
        tasksDone: 0,
        dueLabel: "Starts Apr 1"
    },
    {
        id: "m5",
        title: "Multi-tenant support",
        description: "Enable workspace isolation so multiple teams can use the platform independently.",
        status: "upcoming",
        progress: 0,
        tasksTotal: 20,
        tasksDone: 0,
        dueLabel: "Starts Apr 15"
    }
];

const STATUS_CONFIG: Record<MissionStatus, { icon: React.ComponentProps<typeof Octicons>["name"]; label: string }> = {
    active: { icon: "dot-fill", label: "Active" },
    completed: { icon: "check-circle-fill", label: "Done" },
    upcoming: { icon: "clock", label: "Upcoming" }
};

/**
 * Home dashboard view — shows the "Missions" overview with milestone cards.
 */
export function HomeView() {
    const { theme } = useUnistyles();

    const active = MISSIONS.filter((m) => m.status === "active");
    const completed = MISSIONS.filter((m) => m.status === "completed");
    const upcoming = MISSIONS.filter((m) => m.status === "upcoming");

    const overallDone = MISSIONS.filter((m) => m.status === "completed").length;
    const overallTotal = MISSIONS.length;

    return (
        <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
        >
            {/* Header */}
            <View style={styles.header}>
                <Text style={[styles.pageTitle, { color: theme.colors.onSurface }]}>Missions</Text>
                <Text style={[styles.pageSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                    {overallDone} of {overallTotal} completed
                </Text>
            </View>

            {/* Summary stats row */}
            <View style={styles.statsRow}>
                <StatCard label="Active" value={active.length} color={theme.colors.primary} theme={theme} />
                <StatCard label="Done" value={completed.length} color={theme.colors.tertiary} theme={theme} />
                <StatCard label="Upcoming" value={upcoming.length} color={theme.colors.outline} theme={theme} />
            </View>

            {/* Active missions */}
            {active.length > 0 && <MissionGroup title="Active" missions={active} theme={theme} />}

            {/* Upcoming missions */}
            {upcoming.length > 0 && <MissionGroup title="Upcoming" missions={upcoming} theme={theme} />}

            {/* Completed missions */}
            {completed.length > 0 && <MissionGroup title="Completed" missions={completed} theme={theme} />}
        </ScrollView>
    );
}

// -- Sub-components --

type Theme = ReturnType<typeof useUnistyles>["theme"];

function StatCard({ label, value, color, theme }: { label: string; value: number; color: string; theme: Theme }) {
    return (
        <View style={[styles.statCard, { backgroundColor: theme.colors.surfaceContainerHigh }]}>
            <Text style={[styles.statValue, { color }]}>{value}</Text>
            <Text style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}>{label}</Text>
        </View>
    );
}

function MissionGroup({ title, missions, theme }: { title: string; missions: Mission[]; theme: Theme }) {
    return (
        <View style={styles.group}>
            <Text style={[styles.groupTitle, { color: theme.colors.onSurfaceVariant }]}>{title}</Text>
            {missions.map((mission) => (
                <MissionCard key={mission.id} mission={mission} theme={theme} />
            ))}
        </View>
    );
}

function MissionCard({ mission, theme }: { mission: Mission; theme: Theme }) {
    const config = STATUS_CONFIG[mission.status];
    const progressPct = Math.round(mission.progress * 100);

    const statusColor =
        mission.status === "active"
            ? theme.colors.primary
            : mission.status === "completed"
              ? theme.colors.tertiary
              : theme.colors.outline;

    return (
        <View style={[styles.card, { backgroundColor: theme.colors.surfaceContainer }]}>
            {/* Top row: status + due */}
            <View style={styles.cardTopRow}>
                <View style={styles.statusBadge}>
                    <Octicons name={config.icon} size={12} color={statusColor} />
                    <Text style={[styles.statusText, { color: statusColor }]}>{config.label}</Text>
                </View>
                <Text style={[styles.dueLabel, { color: theme.colors.onSurfaceVariant }]}>{mission.dueLabel}</Text>
            </View>

            {/* Title */}
            <Text style={[styles.cardTitle, { color: theme.colors.onSurface }]}>{mission.title}</Text>

            {/* Description */}
            <Text style={[styles.cardDesc, { color: theme.colors.onSurfaceVariant }]} numberOfLines={2}>
                {mission.description}
            </Text>

            {/* Progress bar */}
            <View style={styles.progressSection}>
                <View style={[styles.progressTrack, { backgroundColor: theme.colors.surfaceContainerHigh }]}>
                    {mission.progress > 0 && (
                        <View
                            style={[
                                styles.progressFill,
                                {
                                    width: `${progressPct}%`,
                                    backgroundColor: statusColor
                                }
                            ]}
                        />
                    )}
                </View>
                <View style={styles.progressStats}>
                    <Text style={[styles.progressText, { color: theme.colors.onSurfaceVariant }]}>
                        {mission.tasksDone}/{mission.tasksTotal} tasks
                    </Text>
                    <Text style={[styles.progressText, { color: theme.colors.onSurfaceVariant }]}>{progressPct}%</Text>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    scroll: {
        flex: 1
    },
    scrollContent: {
        padding: 24,
        paddingBottom: 48,
        maxWidth: 640,
        width: "100%",
        alignSelf: "center"
    },
    header: {
        marginBottom: 24
    },
    pageTitle: {
        fontSize: 26,
        fontWeight: "700"
    },
    pageSubtitle: {
        fontSize: 14,
        marginTop: 4
    },
    statsRow: {
        flexDirection: "row",
        gap: 12,
        marginBottom: 28
    },
    statCard: {
        flex: 1,
        borderRadius: 12,
        padding: 16,
        alignItems: "center",
        gap: 4
    },
    statValue: {
        fontSize: 28,
        fontWeight: "700"
    },
    statLabel: {
        fontSize: 12,
        fontWeight: "500"
    },
    group: {
        marginBottom: 24
    },
    groupTitle: {
        fontSize: 13,
        fontWeight: "600",
        textTransform: "uppercase",
        letterSpacing: 0.5,
        marginBottom: 10
    },
    card: {
        borderRadius: 12,
        padding: 16,
        marginBottom: 10,
        gap: 8
    },
    cardTopRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center"
    },
    statusBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6
    },
    statusText: {
        fontSize: 12,
        fontWeight: "600"
    },
    dueLabel: {
        fontSize: 12
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: "600"
    },
    cardDesc: {
        fontSize: 13,
        lineHeight: 19
    },
    progressSection: {
        marginTop: 4,
        gap: 6
    },
    progressTrack: {
        height: 6,
        borderRadius: 3,
        overflow: "hidden"
    },
    progressFill: {
        height: "100%",
        borderRadius: 3
    },
    progressStats: {
        flexDirection: "row",
        justifyContent: "space-between"
    },
    progressText: {
        fontSize: 12
    }
});
