import { Ionicons } from "@expo/vector-icons";
import { ScrollView, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

// --- Types ---

type TaskType = "bug" | "feature" | "chore";
type Priority = "high" | "medium" | "low";

type SprintTask = {
    id: string;
    title: string;
    assignee: string;
    points: number;
    type: TaskType;
    priority: Priority;
};

type SprintColumn = {
    title: string;
    status: string;
    tasks: SprintTask[];
};

// --- Mock data ---

const sprintColumns: SprintColumn[] = [
    {
        title: "Backlog",
        status: "backlog",
        tasks: [
            {
                id: "t1",
                title: "Add CSV export for reports",
                assignee: "JL",
                points: 5,
                type: "feature",
                priority: "medium"
            },
            {
                id: "t2",
                title: "Update onboarding copy for v3",
                assignee: "KM",
                points: 2,
                type: "chore",
                priority: "low"
            },
            {
                id: "t3",
                title: "Fix login timeout on slow connections",
                assignee: "RD",
                points: 3,
                type: "bug",
                priority: "high"
            }
        ]
    },
    {
        title: "In Progress",
        status: "in_progress",
        tasks: [
            { id: "t4", title: "Add dark mode toggle", assignee: "AW", points: 5, type: "feature", priority: "high" },
            {
                id: "t5",
                title: "Refactor payment service tests",
                assignee: "JL",
                points: 3,
                type: "chore",
                priority: "medium"
            },
            {
                id: "t6",
                title: "Fix avatar upload crash on Android",
                assignee: "RD",
                points: 2,
                type: "bug",
                priority: "high"
            },
            {
                id: "t7",
                title: "Implement push notification preferences",
                assignee: "KM",
                points: 5,
                type: "feature",
                priority: "medium"
            }
        ]
    },
    {
        title: "In Review",
        status: "review",
        tasks: [
            {
                id: "t8",
                title: "Add rate limiting to public API",
                assignee: "AW",
                points: 8,
                type: "feature",
                priority: "high"
            },
            {
                id: "t9",
                title: "Fix decimal rounding in invoice totals",
                assignee: "JL",
                points: 2,
                type: "bug",
                priority: "medium"
            },
            {
                id: "t10",
                title: "Migrate user settings to new schema",
                assignee: "RD",
                points: 3,
                type: "chore",
                priority: "low"
            }
        ]
    },
    {
        title: "Done",
        status: "done",
        tasks: [
            {
                id: "t11",
                title: "Fix sidebar flicker on page transition",
                assignee: "AW",
                points: 3,
                type: "bug",
                priority: "high"
            },
            {
                id: "t12",
                title: "Add search to command palette",
                assignee: "KM",
                points: 8,
                type: "feature",
                priority: "medium"
            },
            {
                id: "t13",
                title: "Remove deprecated analytics events",
                assignee: "JL",
                points: 2,
                type: "chore",
                priority: "low"
            },
            {
                id: "t14",
                title: "Implement workspace invite flow",
                assignee: "RD",
                points: 8,
                type: "feature",
                priority: "high"
            }
        ]
    }
];

const completedPoints = 34;
const totalPoints = 50;
const daysTotal = 10;
const daysElapsed = 7;
const velocity = 8.5;

// Burndown data: ideal line goes from totalPoints to 0 over daysTotal.
// Actual line tracks remaining points at end of each day.
const burndownIdeal = Array.from({ length: daysTotal + 1 }, (_, i) => totalPoints - (totalPoints / daysTotal) * i);
const burndownActual = [50, 47, 42, 40, 35, 30, 24, 16]; // 8 data points (day 0 through day 7)

// Column colors for the segmented progress bar
const COLUMN_COLORS = ["#9CA3AF", "#3B82F6", "#F59E0B", "#10B981"];

// --- Inline components ---

function BurndownChart() {
    const { theme } = useUnistyles();
    const chartWidth = "100%" as const;
    const chartHeight = 80;

    // Normalize values to chart height
    const maxVal = totalPoints;
    const pointsToY = (val: number) => chartHeight - (val / maxVal) * chartHeight;

    return (
        <View style={s.burndownContainer}>
            <Text style={[s.burndownLabel, { color: theme.colors.onSurfaceVariant }]}>Burndown</Text>
            <View style={{ width: chartWidth, height: chartHeight, position: "relative" }}>
                {/* Grid lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((frac) => (
                    <View
                        key={`grid-${frac}`}
                        style={{
                            position: "absolute",
                            top: frac * chartHeight,
                            left: 0,
                            right: 0,
                            height: 1,
                            backgroundColor: theme.colors.outlineVariant,
                            opacity: 0.4
                        }}
                    />
                ))}

                {/* Ideal line - rendered as connected segments */}
                {burndownIdeal.slice(0, -1).map((val, idx) => {
                    const x1 = (idx / daysTotal) * 100;
                    const x2 = ((idx + 1) / daysTotal) * 100;
                    const y1 = pointsToY(val);
                    const y2 = pointsToY(burndownIdeal[idx + 1]);
                    const dx = x2 - x1;
                    const dy = y2 - y1;
                    const length = Math.sqrt(dx * dx + dy * dy);
                    const angle = Math.atan2(dy, dx) * (180 / Math.PI);

                    return (
                        <View
                            key={`ideal-${val}`}
                            style={{
                                position: "absolute",
                                left: `${x1}%`,
                                top: y1,
                                width: `${length}%`,
                                height: 2,
                                backgroundColor: theme.colors.outlineVariant,
                                transform: [{ rotate: `${angle}deg` }],
                                transformOrigin: "left center",
                                opacity: 0.6
                            }}
                        />
                    );
                })}

                {/* Actual line - dots connected by segments */}
                {burndownActual.map((val, idx) => {
                    const x = (idx / daysTotal) * 100;
                    const y = pointsToY(val);
                    return (
                        <View
                            key={`dot-${val}`}
                            style={{
                                position: "absolute",
                                left: `${x}%`,
                                top: y - 4,
                                width: 8,
                                height: 8,
                                borderRadius: 4,
                                backgroundColor: theme.colors.primary,
                                marginLeft: -4,
                                zIndex: 2
                            }}
                        />
                    );
                })}
                {burndownActual.slice(0, -1).map((val, idx) => {
                    const x1Pct = (idx / daysTotal) * 100;
                    const x2Pct = ((idx + 1) / daysTotal) * 100;
                    const y1 = pointsToY(val);
                    const y2 = pointsToY(burndownActual[idx + 1]);
                    const dxPct = x2Pct - x1Pct;
                    const dy = y2 - y1;
                    // Approximate length in px (assume ~250 usable width)
                    const dxPx = (dxPct / 100) * 250;
                    const lengthPx = Math.sqrt(dxPx * dxPx + dy * dy);
                    const angle = Math.atan2(dy, dxPx) * (180 / Math.PI);

                    return (
                        <View
                            key={`line-${val}`}
                            style={{
                                position: "absolute",
                                left: `${x1Pct}%`,
                                top: y1,
                                width: lengthPx,
                                height: 2,
                                backgroundColor: theme.colors.primary,
                                transform: [{ rotate: `${angle}deg` }],
                                transformOrigin: "left center",
                                zIndex: 1
                            }}
                        />
                    );
                })}

                {/* Today marker */}
                <View
                    style={{
                        position: "absolute",
                        left: `${(daysElapsed / daysTotal) * 100}%`,
                        top: 0,
                        bottom: 0,
                        width: 1,
                        backgroundColor: theme.colors.error,
                        opacity: 0.5
                    }}
                />
            </View>
            <View style={s.burndownLegend}>
                <View style={s.legendItem}>
                    <View style={[s.legendDot, { backgroundColor: theme.colors.outlineVariant }]} />
                    <Text style={[s.legendText, { color: theme.colors.onSurfaceVariant }]}>Ideal</Text>
                </View>
                <View style={s.legendItem}>
                    <View style={[s.legendDot, { backgroundColor: theme.colors.primary }]} />
                    <Text style={[s.legendText, { color: theme.colors.onSurfaceVariant }]}>Actual</Text>
                </View>
                <View style={s.legendItem}>
                    <View style={[s.legendLine, { backgroundColor: theme.colors.error, opacity: 0.5 }]} />
                    <Text style={[s.legendText, { color: theme.colors.onSurfaceVariant }]}>Today</Text>
                </View>
            </View>
        </View>
    );
}

function SegmentedProgressBar() {
    const columnPoints = sprintColumns.map((col) => col.tasks.reduce((sum, t) => sum + t.points, 0));

    return (
        <View style={s.segmentedBar}>
            {columnPoints.map((pts, i) => {
                const widthPct = (pts / totalPoints) * 100;
                if (widthPct === 0) return null;
                return (
                    <View
                        key={sprintColumns[i].status}
                        style={{
                            flex: pts,
                            height: 8,
                            backgroundColor: COLUMN_COLORS[i],
                            borderTopLeftRadius: i === 0 ? 4 : 0,
                            borderBottomLeftRadius: i === 0 ? 4 : 0,
                            borderTopRightRadius: i === columnPoints.length - 1 ? 4 : 0,
                            borderBottomRightRadius: i === columnPoints.length - 1 ? 4 : 0
                        }}
                    />
                );
            })}
        </View>
    );
}

function MetricCard({ value, label, color }: { value: string; label: string; color: string }) {
    const { theme } = useUnistyles();
    return (
        <View style={[s.metricCard, { backgroundColor: theme.colors.surfaceContainer }]}>
            <Text style={[s.metricValue, { color }]}>{value}</Text>
            <Text style={[s.metricLabel, { color: theme.colors.onSurfaceVariant }]}>{label}</Text>
        </View>
    );
}

function TypePill({ type }: { type: TaskType }) {
    const config: Record<TaskType, { label: string; bg: string; fg: string }> = {
        bug: { label: "Bug", bg: "#EF444420", fg: "#EF4444" },
        feature: { label: "Feature", bg: "#3B82F620", fg: "#3B82F6" },
        chore: { label: "Chore", bg: "#9CA3AF20", fg: "#9CA3AF" }
    };
    const { label, bg, fg } = config[type];
    return (
        <View style={[s.typePill, { backgroundColor: bg }]}>
            <Text style={[s.typePillText, { color: fg }]}>{label}</Text>
        </View>
    );
}

function TaskCard({ task, isDone }: { task: SprintTask; isDone: boolean }) {
    const { theme } = useUnistyles();
    const priorityColors: Record<Priority, string> = {
        high: "#EF4444",
        medium: "#F59E0B",
        low: "#3B82F6"
    };

    return (
        <View style={[s.taskCard, { backgroundColor: theme.colors.surface }]}>
            {/* Priority strip on left edge */}
            <View style={[s.priorityStrip, { backgroundColor: priorityColors[task.priority] }]} />

            <View style={s.taskCardContent}>
                <Text
                    style={[
                        s.taskTitle,
                        { color: isDone ? theme.colors.onSurfaceVariant : theme.colors.onSurface },
                        isDone && s.taskTitleDone
                    ]}
                    numberOfLines={2}
                >
                    {task.title}
                </Text>

                <View style={s.taskCardBottom}>
                    {/* Assignee initials */}
                    <View style={[s.assigneeCircle, { backgroundColor: theme.colors.primary + "20" }]}>
                        <Text style={[s.assigneeText, { color: theme.colors.primary }]}>{task.assignee}</Text>
                    </View>

                    <TypePill type={task.type} />

                    {/* Story points circle */}
                    <View style={[s.pointsCircle, { backgroundColor: theme.colors.tertiary + "18" }]}>
                        <Text style={[s.pointsText, { color: theme.colors.tertiary }]}>{task.points}</Text>
                    </View>
                </View>
            </View>
        </View>
    );
}

function KanbanColumn({ column, index }: { column: SprintColumn; index: number }) {
    const { theme } = useUnistyles();
    const columnColor = COLUMN_COLORS[index];
    const columnPoints = column.tasks.reduce((sum, t) => sum + t.points, 0);
    const isDone = column.status === "done";

    return (
        <View style={[s.kanbanColumn, { backgroundColor: theme.colors.surfaceContainer }]}>
            {/* Colored top border */}
            <View style={[s.columnTopBorder, { backgroundColor: columnColor }]} />

            {/* Column header */}
            <View style={s.columnHeader}>
                <View style={s.columnHeaderLeft}>
                    <Text style={[s.columnTitle, { color: theme.colors.onSurface }]}>{column.title}</Text>
                    <View style={[s.countBadge, { backgroundColor: columnColor + "20" }]}>
                        <Text style={[s.countBadgeText, { color: columnColor }]}>{column.tasks.length}</Text>
                    </View>
                </View>
                <Text style={[s.columnPoints, { color: theme.colors.onSurfaceVariant }]}>{columnPoints} pts</Text>
            </View>

            {/* Task cards */}
            <ScrollView style={s.columnScroll} showsVerticalScrollIndicator={false} nestedScrollEnabled>
                {column.tasks.map((task) => (
                    <TaskCard key={task.id} task={task} isDone={isDone} />
                ))}
            </ScrollView>
        </View>
    );
}

// --- Main component ---

export function SprintBoardPage() {
    const { theme } = useUnistyles();

    return (
        <ScrollView
            contentContainerStyle={[s.root, { backgroundColor: theme.colors.surfaceContainerHighest }]}
            showsVerticalScrollIndicator={false}
        >
            {/* Sprint header */}
            <View style={s.sprintHeader}>
                <View style={s.sprintTitleRow}>
                    <View>
                        <Text style={[s.sprintName, { color: theme.colors.onSurface }]}>Sprint 24</Text>
                        <Text style={[s.sprintDates, { color: theme.colors.onSurfaceVariant }]}>
                            Feb 24 - Mar 7, 2026
                        </Text>
                    </View>
                    <View style={[s.sprintStatusBadge, { backgroundColor: theme.colors.primary + "18" }]}>
                        <Ionicons name="timer-outline" size={14} color={theme.colors.primary} />
                        <Text style={[s.sprintStatusText, { color: theme.colors.primary }]}>Active</Text>
                    </View>
                </View>

                {/* Metrics row */}
                <View style={s.metricsRow}>
                    <MetricCard value={`${velocity}`} label="Velocity" color={theme.colors.primary} />
                    <MetricCard
                        value={`${totalPoints - completedPoints}`}
                        label="Remaining"
                        color={theme.colors.error}
                    />
                    <MetricCard value={`${daysTotal - daysElapsed}`} label="Days Left" color={theme.colors.tertiary} />
                </View>

                {/* Story points with segmented bar */}
                <View style={[s.pointsSection, { backgroundColor: theme.colors.surfaceContainer }]}>
                    <View style={s.pointsHeader}>
                        <Text style={[s.pointsLarge, { color: theme.colors.onSurface }]}>
                            {completedPoints}
                            <Text style={[s.pointsTotal, { color: theme.colors.onSurfaceVariant }]}>
                                {" "}
                                / {totalPoints}
                            </Text>
                        </Text>
                        <Text style={[s.pointsPercentage, { color: theme.colors.primary }]}>
                            {Math.round((completedPoints / totalPoints) * 100)}%
                        </Text>
                    </View>
                    <SegmentedProgressBar />
                    <View style={s.segmentLegend}>
                        {sprintColumns.map((col, i) => (
                            <View key={col.status} style={s.segmentLegendItem}>
                                <View style={[s.segmentLegendDot, { backgroundColor: COLUMN_COLORS[i] }]} />
                                <Text style={[s.segmentLegendText, { color: theme.colors.onSurfaceVariant }]}>
                                    {col.title}
                                </Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* Burndown chart */}
                <View style={[s.burndownSection, { backgroundColor: theme.colors.surfaceContainer }]}>
                    <BurndownChart />
                </View>
            </View>

            {/* Kanban columns */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.kanbanContainer}
                style={s.kanbanScroll}
            >
                {sprintColumns.map((column, index) => (
                    <KanbanColumn key={column.status} column={column} index={index} />
                ))}
            </ScrollView>
        </ScrollView>
    );
}

// --- Styles ---

const s = StyleSheet.create((theme) => ({
    root: {
        maxWidth: theme.layout.maxWidth,
        width: "100%",
        alignSelf: "center",
        paddingBottom: 32
    },

    // Sprint header
    sprintHeader: {
        padding: 16,
        gap: 12
    },
    sprintTitleRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start"
    },
    sprintName: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 24,
        lineHeight: 30
    },
    sprintDates: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13,
        lineHeight: 18,
        marginTop: 2
    },
    sprintStatusBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12
    },
    sprintStatusText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 12
    },

    // Metrics row
    metricsRow: {
        flexDirection: "row",
        gap: 8
    },
    metricCard: {
        flex: 1,
        alignItems: "center",
        paddingVertical: 12,
        borderRadius: 12,
        gap: 2
    },
    metricValue: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 22,
        lineHeight: 28
    },
    metricLabel: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 11,
        lineHeight: 14
    },

    // Points section
    pointsSection: {
        borderRadius: 12,
        padding: 14,
        gap: 10
    },
    pointsHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "baseline"
    },
    pointsLarge: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 28,
        lineHeight: 34
    },
    pointsTotal: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 20
    },
    pointsPercentage: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 16
    },
    segmentedBar: {
        flexDirection: "row",
        height: 8,
        borderRadius: 4,
        overflow: "hidden"
    },
    segmentLegend: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 12,
        marginTop: 2
    },
    segmentLegendItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4
    },
    segmentLegendDot: {
        width: 8,
        height: 8,
        borderRadius: 4
    },
    segmentLegendText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 11
    },

    // Burndown section
    burndownSection: {
        borderRadius: 12,
        padding: 14
    },
    burndownContainer: {
        gap: 8
    },
    burndownLabel: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 13
    },
    burndownLegend: {
        flexDirection: "row",
        gap: 16,
        marginTop: 4
    },
    legendItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4
    },
    legendDot: {
        width: 6,
        height: 6,
        borderRadius: 3
    },
    legendLine: {
        width: 12,
        height: 2,
        borderRadius: 1
    },
    legendText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 10
    },

    // Kanban board
    kanbanScroll: {
        flex: 1
    },
    kanbanContainer: {
        paddingHorizontal: 16,
        gap: 10,
        paddingBottom: 16
    },
    kanbanColumn: {
        width: 220,
        borderRadius: 12,
        overflow: "hidden",
        maxHeight: 480
    },
    columnTopBorder: {
        height: 3
    },
    columnHeader: {
        paddingHorizontal: 12,
        paddingVertical: 10,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center"
    },
    columnHeaderLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6
    },
    columnTitle: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 13
    },
    countBadge: {
        minWidth: 20,
        height: 20,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 6
    },
    countBadgeText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 11
    },
    columnPoints: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 11
    },
    columnScroll: {
        paddingHorizontal: 8,
        paddingBottom: 8
    },

    // Task card
    taskCard: {
        borderRadius: 8,
        marginBottom: 6,
        flexDirection: "row",
        overflow: "hidden",
        shadowColor: "#000",
        shadowOpacity: 0.04,
        shadowOffset: { width: 0, height: 1 },
        shadowRadius: 2,
        elevation: 1
    },
    priorityStrip: {
        width: 4
    },
    taskCardContent: {
        flex: 1,
        padding: 10,
        gap: 8
    },
    taskTitle: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13,
        lineHeight: 18
    },
    taskTitleDone: {
        textDecorationLine: "line-through",
        opacity: 0.7
    },
    taskCardBottom: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6
    },
    assigneeCircle: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center"
    },
    assigneeText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 9
    },
    typePill: {
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 8
    },
    typePillText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 10
    },
    pointsCircle: {
        width: 22,
        height: 22,
        borderRadius: 11,
        alignItems: "center",
        justifyContent: "center",
        marginLeft: "auto"
    },
    pointsText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 10
    }
}));
