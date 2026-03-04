import { Ionicons } from "@expo/vector-icons";
import * as React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

// --- Types ---

type TaskStatus = "upcoming" | "due" | "overdue";
type Frequency = "monthly" | "quarterly" | "annual";
type Area = "Kitchen" | "Bathroom" | "Exterior" | "HVAC" | "Plumbing" | "Electrical";
type StatusFilter = "all" | TaskStatus;

type MaintenanceTask = {
    id: string;
    name: string;
    area: Area;
    frequency: Frequency;
    lastCompleted: string;
    nextDue: string;
    status: TaskStatus;
    estimatedCost: number;
    completed: boolean;
};

// --- Area config ---

const AREA_ICONS: Record<Area, keyof typeof Ionicons.glyphMap> = {
    Kitchen: "restaurant-outline",
    Bathroom: "water-outline",
    Exterior: "home-outline",
    HVAC: "thermometer-outline",
    Plumbing: "construct-outline",
    Electrical: "flash-outline"
};

const AREA_ORDER: Area[] = ["Kitchen", "Bathroom", "Exterior", "HVAC", "Plumbing", "Electrical"];

const STATUS_COLORS: Record<TaskStatus, string> = {
    upcoming: "#16a34a",
    due: "#d97706",
    overdue: "#dc2626"
};

const STATUS_LABELS: Record<TaskStatus, string> = {
    upcoming: "Upcoming",
    due: "Due Soon",
    overdue: "Overdue"
};

const FREQUENCY_LABELS: Record<Frequency, string> = {
    monthly: "Monthly",
    quarterly: "Quarterly",
    annual: "Annual"
};

// --- Mock data ---

const initialTasks: MaintenanceTask[] = [
    // Kitchen
    {
        id: "k1",
        name: "Clean range hood filter",
        area: "Kitchen",
        frequency: "monthly",
        lastCompleted: "Jan 15",
        nextDue: "Feb 15",
        status: "overdue",
        estimatedCost: 0,
        completed: false
    },
    {
        id: "k2",
        name: "Deep clean dishwasher",
        area: "Kitchen",
        frequency: "quarterly",
        lastCompleted: "Dec 1",
        nextDue: "Mar 1",
        status: "due",
        estimatedCost: 15,
        completed: false
    },
    {
        id: "k3",
        name: "Replace water filter",
        area: "Kitchen",
        frequency: "quarterly",
        lastCompleted: "Jan 10",
        nextDue: "Apr 10",
        status: "upcoming",
        estimatedCost: 35,
        completed: false
    },
    // Bathroom
    {
        id: "b1",
        name: "Re-caulk shower edges",
        area: "Bathroom",
        frequency: "annual",
        lastCompleted: "Mar 2025",
        nextDue: "Mar 2026",
        status: "due",
        estimatedCost: 20,
        completed: false
    },
    {
        id: "b2",
        name: "Clean exhaust fan",
        area: "Bathroom",
        frequency: "quarterly",
        lastCompleted: "Nov 20",
        nextDue: "Feb 20",
        status: "overdue",
        estimatedCost: 0,
        completed: false
    },
    {
        id: "b3",
        name: "Inspect toilet seals",
        area: "Bathroom",
        frequency: "annual",
        lastCompleted: "Jun 2025",
        nextDue: "Jun 2026",
        status: "upcoming",
        estimatedCost: 10,
        completed: false
    },
    // Exterior
    {
        id: "e1",
        name: "Clean gutters",
        area: "Exterior",
        frequency: "quarterly",
        lastCompleted: "Nov 5",
        nextDue: "Feb 5",
        status: "overdue",
        estimatedCost: 150,
        completed: false
    },
    {
        id: "e2",
        name: "Power wash siding",
        area: "Exterior",
        frequency: "annual",
        lastCompleted: "Apr 2025",
        nextDue: "Apr 2026",
        status: "upcoming",
        estimatedCost: 200,
        completed: false
    },
    {
        id: "e3",
        name: "Inspect roof shingles",
        area: "Exterior",
        frequency: "annual",
        lastCompleted: "Sep 2025",
        nextDue: "Sep 2026",
        status: "upcoming",
        estimatedCost: 0,
        completed: false
    },
    // HVAC
    {
        id: "h1",
        name: "Replace air filter",
        area: "HVAC",
        frequency: "monthly",
        lastCompleted: "Feb 1",
        nextDue: "Mar 1",
        status: "due",
        estimatedCost: 25,
        completed: false
    },
    {
        id: "h2",
        name: "Professional HVAC tune-up",
        area: "HVAC",
        frequency: "annual",
        lastCompleted: "Apr 2025",
        nextDue: "Apr 2026",
        status: "upcoming",
        estimatedCost: 300,
        completed: false
    },
    {
        id: "h3",
        name: "Clean vents and registers",
        area: "HVAC",
        frequency: "quarterly",
        lastCompleted: "Dec 15",
        nextDue: "Mar 15",
        status: "due",
        estimatedCost: 0,
        completed: false
    },
    // Plumbing
    {
        id: "p1",
        name: "Flush water heater",
        area: "Plumbing",
        frequency: "annual",
        lastCompleted: "Feb 2025",
        nextDue: "Feb 2026",
        status: "overdue",
        estimatedCost: 0,
        completed: false
    },
    {
        id: "p2",
        name: "Check for pipe leaks",
        area: "Plumbing",
        frequency: "quarterly",
        lastCompleted: "Jan 5",
        nextDue: "Apr 5",
        status: "upcoming",
        estimatedCost: 0,
        completed: false
    },
    {
        id: "p3",
        name: "Clean drain traps",
        area: "Plumbing",
        frequency: "monthly",
        lastCompleted: "Feb 10",
        nextDue: "Mar 10",
        status: "due",
        estimatedCost: 10,
        completed: false
    },
    // Electrical
    {
        id: "el1",
        name: "Test smoke detectors",
        area: "Electrical",
        frequency: "monthly",
        lastCompleted: "Feb 1",
        nextDue: "Mar 1",
        status: "due",
        estimatedCost: 0,
        completed: false
    },
    {
        id: "el2",
        name: "Replace GFCI outlets",
        area: "Electrical",
        frequency: "annual",
        lastCompleted: "May 2025",
        nextDue: "May 2026",
        status: "upcoming",
        estimatedCost: 80,
        completed: false
    },
    {
        id: "el3",
        name: "Inspect electrical panel",
        area: "Electrical",
        frequency: "annual",
        lastCompleted: "Jan 2025",
        nextDue: "Jan 2026",
        status: "overdue",
        estimatedCost: 120,
        completed: false
    }
];

// --- Helper ---

function formatCost(cost: number): string {
    if (cost === 0) return "Free";
    return `$${cost}`;
}

// --- Metric Card ---

function MetricCard({
    icon,
    iconColor,
    value,
    label,
    badgeCount,
    badgeColor
}: {
    icon: keyof typeof Ionicons.glyphMap;
    iconColor: string;
    value: string;
    label: string;
    badgeCount?: number;
    badgeColor?: string;
}) {
    const { theme } = useUnistyles();

    return (
        <View style={[styles.metricCard, { backgroundColor: theme.colors.surfaceContainer }]}>
            <View style={styles.metricIconRow}>
                <View style={[styles.metricIconCircle, { backgroundColor: `${iconColor}18` }]}>
                    <Ionicons name={icon} size={20} color={iconColor} />
                </View>
                {badgeCount !== undefined && badgeCount > 0 && (
                    <View style={[styles.warningBadge, { backgroundColor: badgeColor || theme.colors.error }]}>
                        <Ionicons name="alert" size={10} color="#ffffff" />
                        <Text style={styles.warningBadgeText}>{badgeCount}</Text>
                    </View>
                )}
            </View>
            <Text style={[styles.metricValue, { color: iconColor }]}>{value}</Text>
            <Text style={[styles.metricLabel, { color: theme.colors.onSurfaceVariant }]}>{label}</Text>
        </View>
    );
}

// --- Progress Bar ---

function ProgressBar({ completed, total, color }: { completed: number; total: number; color: string }) {
    const pct = total > 0 ? (completed / total) * 100 : 0;

    return (
        <View style={[styles.progressTrack, { backgroundColor: `${color}20` }]}>
            <View style={[styles.progressFill, { width: `${pct}%` as unknown as number, backgroundColor: color }]} />
        </View>
    );
}

// --- Frequency Chip ---

function FrequencyChip({ frequency }: { frequency: Frequency }) {
    const { theme } = useUnistyles();
    const chipColors: Record<Frequency, string> = {
        monthly: theme.colors.primary,
        quarterly: theme.colors.tertiary,
        annual: "#8B5CF6"
    };
    const color = chipColors[frequency];

    return (
        <View style={[styles.frequencyChip, { backgroundColor: `${color}15` }]}>
            <Text style={[styles.frequencyChipText, { color }]}>{FREQUENCY_LABELS[frequency]}</Text>
        </View>
    );
}

// --- Status Badge ---

function StatusBadge({ status }: { status: TaskStatus }) {
    const color = STATUS_COLORS[status];

    return (
        <View style={[styles.statusBadge, { backgroundColor: `${color}18` }]}>
            <View style={[styles.statusDot, { backgroundColor: color }]} />
            <Text style={[styles.statusBadgeText, { color }]}>{STATUS_LABELS[status]}</Text>
        </View>
    );
}

// --- Task Row ---

function TaskRow({ task, onToggle }: { task: MaintenanceTask; onToggle: (id: string) => void }) {
    const { theme } = useUnistyles();
    const statusColor = STATUS_COLORS[task.status];

    return (
        <Pressable
            onPress={() => onToggle(task.id)}
            style={({ pressed }) => [
                styles.taskRow,
                {
                    backgroundColor: task.completed ? `${theme.colors.primary}08` : theme.colors.surfaceContainer,
                    borderColor: task.completed ? theme.colors.primary : theme.colors.outlineVariant,
                    opacity: pressed ? 0.85 : 1
                }
            ]}
        >
            {/* Left status indicator bar */}
            <View
                style={[styles.taskStatusBar, { backgroundColor: task.completed ? theme.colors.primary : statusColor }]}
            />

            <View style={styles.taskContent}>
                {/* Top row: checkbox + name + status badge */}
                <View style={styles.taskTopRow}>
                    <View
                        style={[
                            styles.checkbox,
                            {
                                backgroundColor: task.completed ? theme.colors.primary : "transparent",
                                borderColor: task.completed ? theme.colors.primary : theme.colors.outline
                            }
                        ]}
                    >
                        {task.completed && <Ionicons name="checkmark" size={14} color="#ffffff" />}
                    </View>
                    <Text
                        style={[
                            styles.taskName,
                            {
                                color: task.completed ? theme.colors.onSurfaceVariant : theme.colors.onSurface,
                                textDecorationLine: task.completed ? "line-through" : "none"
                            }
                        ]}
                        numberOfLines={1}
                    >
                        {task.name}
                    </Text>
                </View>

                {/* Bottom row: frequency chip, dates, cost, status */}
                <View style={styles.taskBottomRow}>
                    <FrequencyChip frequency={task.frequency} />

                    <View style={styles.taskDates}>
                        <View style={styles.dateItem}>
                            <Ionicons name="checkmark-done-outline" size={12} color={theme.colors.onSurfaceVariant} />
                            <Text style={[styles.dateText, { color: theme.colors.onSurfaceVariant }]}>
                                {task.lastCompleted}
                            </Text>
                        </View>
                        <View style={styles.dateItem}>
                            <Ionicons name="calendar-outline" size={12} color={statusColor} />
                            <Text style={[styles.dateText, { color: statusColor }]}>{task.nextDue}</Text>
                        </View>
                    </View>

                    <Text style={[styles.costText, { color: theme.colors.onSurfaceVariant }]}>
                        {formatCost(task.estimatedCost)}
                    </Text>

                    <StatusBadge status={task.status} />
                </View>
            </View>
        </Pressable>
    );
}

// --- Area Section Header ---

function AreaSectionHeader({
    area,
    taskCount,
    completedCount,
    totalCost
}: {
    area: Area;
    taskCount: number;
    completedCount: number;
    totalCost: number;
}) {
    const { theme } = useUnistyles();
    const icon = AREA_ICONS[area];

    return (
        <View style={[styles.areaHeader, { borderBottomColor: theme.colors.outlineVariant }]}>
            <View style={[styles.areaIconCircle, { backgroundColor: `${theme.colors.primary}14` }]}>
                <Ionicons name={icon} size={20} color={theme.colors.primary} />
            </View>
            <View style={styles.areaHeaderTextCol}>
                <Text style={[styles.areaTitle, { color: theme.colors.onSurface }]}>{area}</Text>
                <Text style={[styles.areaSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                    {completedCount}/{taskCount} done
                </Text>
            </View>
            <View style={styles.areaHeaderRight}>
                <Text style={[styles.areaCost, { color: theme.colors.onSurfaceVariant }]}>~${totalCost}</Text>
                <ProgressBar completed={completedCount} total={taskCount} color={theme.colors.primary} />
            </View>
        </View>
    );
}

// --- Filter Pills ---

function FilterPills({
    active,
    onSelect,
    counts
}: {
    active: StatusFilter;
    onSelect: (filter: StatusFilter) => void;
    counts: Record<StatusFilter, number>;
}) {
    const { theme } = useUnistyles();

    const filters: { key: StatusFilter; label: string }[] = [
        { key: "all", label: "All" },
        { key: "overdue", label: "Overdue" },
        { key: "due", label: "Due Soon" },
        { key: "upcoming", label: "Upcoming" }
    ];

    return (
        <View style={styles.filterRow}>
            {filters.map(({ key, label }) => {
                const isActive = active === key;
                const accentColor = key === "all" ? theme.colors.primary : STATUS_COLORS[key as TaskStatus];

                return (
                    <Pressable
                        key={key}
                        onPress={() => onSelect(key)}
                        style={[
                            styles.filterPill,
                            {
                                backgroundColor: isActive ? accentColor : theme.colors.surfaceContainer,
                                borderColor: isActive ? accentColor : theme.colors.outlineVariant
                            }
                        ]}
                    >
                        <Text
                            style={[
                                styles.filterPillText,
                                { color: isActive ? "#ffffff" : theme.colors.onSurfaceVariant }
                            ]}
                        >
                            {label}
                        </Text>
                        <View
                            style={[
                                styles.filterPillCount,
                                {
                                    backgroundColor: isActive ? "rgba(255,255,255,0.25)" : `${accentColor}20`
                                }
                            ]}
                        >
                            <Text style={[styles.filterPillCountText, { color: isActive ? "#ffffff" : accentColor }]}>
                                {counts[key]}
                            </Text>
                        </View>
                    </Pressable>
                );
            })}
        </View>
    );
}

// --- Cost Summary Bar ---

function CostSummaryBar({ tasks }: { tasks: MaintenanceTask[] }) {
    const { theme } = useUnistyles();
    const activeTasks = tasks.filter((t) => !t.completed);
    const totalCost = activeTasks.reduce((sum, t) => sum + t.estimatedCost, 0);
    const overdueCost = activeTasks.filter((t) => t.status === "overdue").reduce((sum, t) => sum + t.estimatedCost, 0);
    const dueCost = activeTasks.filter((t) => t.status === "due").reduce((sum, t) => sum + t.estimatedCost, 0);

    return (
        <View style={[styles.costBar, { backgroundColor: theme.colors.surfaceContainer }]}>
            <View style={styles.costBarHeader}>
                <Ionicons name="wallet-outline" size={16} color={theme.colors.onSurface} />
                <Text style={[styles.costBarTitle, { color: theme.colors.onSurface }]}>Estimated Costs</Text>
            </View>
            <View style={styles.costBarRow}>
                <View style={styles.costBarItem}>
                    <Text style={[styles.costBarAmount, { color: theme.colors.onSurface }]}>${totalCost}</Text>
                    <Text style={[styles.costBarLabel, { color: theme.colors.onSurfaceVariant }]}>Total</Text>
                </View>
                <View style={[styles.costBarDivider, { backgroundColor: theme.colors.outlineVariant }]} />
                <View style={styles.costBarItem}>
                    <Text style={[styles.costBarAmount, { color: STATUS_COLORS.overdue }]}>${overdueCost}</Text>
                    <Text style={[styles.costBarLabel, { color: theme.colors.onSurfaceVariant }]}>Overdue</Text>
                </View>
                <View style={[styles.costBarDivider, { backgroundColor: theme.colors.outlineVariant }]} />
                <View style={styles.costBarItem}>
                    <Text style={[styles.costBarAmount, { color: STATUS_COLORS.due }]}>${dueCost}</Text>
                    <Text style={[styles.costBarLabel, { color: theme.colors.onSurfaceVariant }]}>Due Soon</Text>
                </View>
            </View>
        </View>
    );
}

// --- Main Component ---

export function HomeMaintenancePage() {
    const { theme } = useUnistyles();
    const [tasks, setTasks] = React.useState(initialTasks);
    const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");

    const toggleTask = React.useCallback((id: string) => {
        setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)));
    }, []);

    // Compute counts
    const activeTasks = tasks.filter((t) => !t.completed);
    const upcomingCount = activeTasks.filter((t) => t.status === "upcoming").length;
    const dueCount = activeTasks.filter((t) => t.status === "due").length;
    const overdueCount = activeTasks.filter((t) => t.status === "overdue").length;
    const completedCount = tasks.filter((t) => t.completed).length;

    const filterCounts: Record<StatusFilter, number> = {
        all: tasks.length,
        overdue: tasks.filter((t) => t.status === "overdue").length,
        due: tasks.filter((t) => t.status === "due").length,
        upcoming: tasks.filter((t) => t.status === "upcoming").length
    };

    // Filter tasks
    const filteredTasks = statusFilter === "all" ? tasks : tasks.filter((t) => t.status === statusFilter);

    // Group filtered tasks by area
    const groupedByArea = React.useMemo(() => {
        const groups: { area: Area; tasks: MaintenanceTask[] }[] = [];
        for (const area of AREA_ORDER) {
            const areaTasks = filteredTasks.filter((t) => t.area === area);
            if (areaTasks.length > 0) {
                groups.push({ area, tasks: areaTasks });
            }
        }
        return groups;
    }, [filteredTasks]);

    return (
        <ScrollView
            style={{ flex: 1, backgroundColor: theme.colors.surface }}
            contentContainerStyle={styles.scrollContent}
        >
            {/* Header area with title and date */}
            <View style={styles.pageHeader}>
                <View style={styles.pageTitleRow}>
                    <Ionicons name="home" size={24} color={theme.colors.primary} />
                    <Text style={[styles.pageTitle, { color: theme.colors.onSurface }]}>Home Maintenance</Text>
                </View>
                <Text style={[styles.pageDate, { color: theme.colors.onSurfaceVariant }]}>March 3, 2026</Text>
            </View>

            {/* Metrics row */}
            <View style={styles.metricsRow}>
                <MetricCard
                    icon="time-outline"
                    iconColor={STATUS_COLORS.upcoming}
                    value={String(upcomingCount)}
                    label="Upcoming"
                />
                <MetricCard
                    icon="alert-circle-outline"
                    iconColor={STATUS_COLORS.due}
                    value={String(dueCount)}
                    label="Due Soon"
                />
                <MetricCard
                    icon="warning-outline"
                    iconColor={STATUS_COLORS.overdue}
                    value={String(overdueCount)}
                    label="Overdue"
                    badgeCount={overdueCount}
                    badgeColor={STATUS_COLORS.overdue}
                />
                <MetricCard
                    icon="checkmark-circle-outline"
                    iconColor={theme.colors.primary}
                    value={String(completedCount)}
                    label="Done"
                />
            </View>

            {/* Overall progress */}
            <View style={[styles.overallProgress, { backgroundColor: theme.colors.surfaceContainer }]}>
                <View style={styles.overallProgressHeader}>
                    <Text style={[styles.overallProgressTitle, { color: theme.colors.onSurface }]}>
                        Overall Progress
                    </Text>
                    <Text style={[styles.overallProgressPct, { color: theme.colors.primary }]}>
                        {tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0}%
                    </Text>
                </View>
                <ProgressBar completed={completedCount} total={tasks.length} color={theme.colors.primary} />
                <Text style={[styles.overallProgressSub, { color: theme.colors.onSurfaceVariant }]}>
                    {completedCount} of {tasks.length} maintenance tasks completed
                </Text>
            </View>

            {/* Cost summary */}
            <CostSummaryBar tasks={tasks} />

            {/* Status filter */}
            <FilterPills active={statusFilter} onSelect={setStatusFilter} counts={filterCounts} />

            {/* Grouped task lists */}
            {groupedByArea.map(({ area, tasks: areaTasks }) => {
                const areaCompletedCount = areaTasks.filter((t) => t.completed).length;
                const areaTotalCost = areaTasks
                    .filter((t) => !t.completed)
                    .reduce((sum, t) => sum + t.estimatedCost, 0);

                return (
                    <View key={area} style={styles.areaSection}>
                        <AreaSectionHeader
                            area={area}
                            taskCount={areaTasks.length}
                            completedCount={areaCompletedCount}
                            totalCost={areaTotalCost}
                        />
                        <View style={styles.taskList}>
                            {areaTasks.map((task) => (
                                <TaskRow key={task.id} task={task} onToggle={toggleTask} />
                            ))}
                        </View>
                    </View>
                );
            })}

            {/* Empty state */}
            {groupedByArea.length === 0 && (
                <View style={styles.emptyState}>
                    <Ionicons name="checkmark-done-circle-outline" size={48} color={theme.colors.onSurfaceVariant} />
                    <Text style={[styles.emptyStateText, { color: theme.colors.onSurfaceVariant }]}>
                        No tasks match this filter
                    </Text>
                </View>
            )}
        </ScrollView>
    );
}

// --- Styles ---

const styles = StyleSheet.create((theme) => ({
    scrollContent: {
        maxWidth: theme.layout.maxWidth,
        width: "100%",
        alignSelf: "center",
        padding: 16,
        gap: 16,
        paddingBottom: 48
    },

    // Page header
    pageHeader: {
        gap: 4,
        paddingTop: 8
    },
    pageTitleRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10
    },
    pageTitle: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 22,
        lineHeight: 28
    },
    pageDate: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13,
        marginLeft: 34
    },

    // Metrics
    metricsRow: {
        flexDirection: "row",
        gap: 8
    },
    metricCard: {
        flex: 1,
        borderRadius: 14,
        padding: 12,
        gap: 6
    },
    metricIconRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between"
    },
    metricIconCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center"
    },
    warningBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 2,
        paddingHorizontal: 5,
        paddingVertical: 2,
        borderRadius: 8
    },
    warningBadgeText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 10,
        color: "#ffffff"
    },
    metricValue: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 24,
        lineHeight: 28
    },
    metricLabel: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 11,
        lineHeight: 14
    },

    // Overall progress
    overallProgress: {
        borderRadius: 14,
        padding: 16,
        gap: 10
    },
    overallProgressHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center"
    },
    overallProgressTitle: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 14
    },
    overallProgressPct: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 16
    },
    overallProgressSub: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12
    },

    // Progress bar
    progressTrack: {
        height: 8,
        borderRadius: 4,
        overflow: "hidden"
    },
    progressFill: {
        height: "100%",
        borderRadius: 4
    },

    // Cost summary bar
    costBar: {
        borderRadius: 14,
        padding: 16,
        gap: 12
    },
    costBarHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8
    },
    costBarTitle: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 14
    },
    costBarRow: {
        flexDirection: "row",
        alignItems: "center"
    },
    costBarItem: {
        flex: 1,
        alignItems: "center",
        gap: 2
    },
    costBarAmount: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 18,
        lineHeight: 24
    },
    costBarLabel: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 11
    },
    costBarDivider: {
        width: 1,
        height: 32
    },

    // Filter pills
    filterRow: {
        flexDirection: "row",
        gap: 8,
        flexWrap: "wrap"
    },
    filterPill: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 20,
        borderWidth: 1
    },
    filterPillText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13
    },
    filterPillCount: {
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 8
    },
    filterPillCountText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 11
    },

    // Frequency chip
    frequencyChip: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10
    },
    frequencyChipText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 10,
        lineHeight: 14
    },

    // Status badge
    statusBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3
    },
    statusBadgeText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 10,
        lineHeight: 14
    },

    // Area section
    areaSection: {
        gap: 10
    },
    areaHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingBottom: 10,
        borderBottomWidth: 1
    },
    areaIconCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center"
    },
    areaHeaderTextCol: {
        flex: 1,
        gap: 1
    },
    areaTitle: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 15,
        lineHeight: 20
    },
    areaSubtitle: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12
    },
    areaHeaderRight: {
        alignItems: "flex-end",
        gap: 4,
        width: 80
    },
    areaCost: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 12
    },

    // Task list
    taskList: {
        gap: 8
    },

    // Task row
    taskRow: {
        flexDirection: "row",
        borderRadius: 12,
        borderWidth: 1,
        overflow: "hidden"
    },
    taskStatusBar: {
        width: 4
    },
    taskContent: {
        flex: 1,
        padding: 12,
        gap: 8
    },
    taskTopRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10
    },
    checkbox: {
        width: 22,
        height: 22,
        borderRadius: 6,
        borderWidth: 2,
        alignItems: "center",
        justifyContent: "center"
    },
    taskName: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 14,
        lineHeight: 18,
        flex: 1
    },
    taskBottomRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap",
        marginLeft: 32
    },
    taskDates: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8
    },
    dateItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 3
    },
    dateText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 11,
        lineHeight: 14
    },
    costText: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 11,
        marginLeft: "auto"
    },

    // Empty state
    emptyState: {
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 48,
        gap: 12
    },
    emptyStateText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 14
    }
}));
