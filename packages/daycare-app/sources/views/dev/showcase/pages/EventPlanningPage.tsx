import { Ionicons } from "@expo/vector-icons";
import * as React from "react";
import { Pressable, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { ShowcasePage } from "../components/ShowcasePage";

// --- Types ---

type Priority = "high" | "medium" | "low";

type Task = {
    id: string;
    description: string;
    assignee: string;
    deadline: string;
    budget: number;
    priority: Priority;
    done: boolean;
};

type Category = {
    name: string;
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
    tasks: Task[];
};

// --- Constants ---

const PRIORITY_COLORS: Record<Priority, string> = {
    high: "#ef4444",
    medium: "#f59e0b",
    low: "#22c55e"
};

const PRIORITY_LABELS: Record<Priority, string> = {
    high: "High",
    medium: "Med",
    low: "Low"
};

const EVENT_NAME = "TechSummit 2026";
const EVENT_DATE = "2026-04-18";
const EVENT_VENUE = "Grand Pacific Convention Center, Toronto";

const TOTAL_BUDGET = 185000;
const SPENT_BUDGET = 127450;
const REMAINING_BUDGET = TOTAL_BUDGET - SPENT_BUDGET;

// --- Mock data ---

const CATEGORIES: Category[] = [
    {
        name: "Venue & Logistics",
        icon: "business-outline",
        color: "#3b82f6",
        tasks: [
            {
                id: "v1",
                description: "Finalize floor plan layout with venue manager",
                assignee: "Sarah Chen",
                deadline: "Mar 10",
                budget: 2500,
                priority: "high",
                done: true
            },
            {
                id: "v2",
                description: "Coordinate parking and shuttle service",
                assignee: "Mark Rivera",
                deadline: "Mar 20",
                budget: 4800,
                priority: "medium",
                done: false
            },
            {
                id: "v3",
                description: "Arrange signage and wayfinding displays",
                assignee: "Priya Patel",
                deadline: "Apr 01",
                budget: 1200,
                priority: "low",
                done: false
            }
        ]
    },
    {
        name: "Catering",
        icon: "restaurant-outline",
        color: "#f59e0b",
        tasks: [
            {
                id: "c1",
                description: "Confirm menu selection with caterer",
                assignee: "Elena Voss",
                deadline: "Mar 08",
                budget: 18500,
                priority: "high",
                done: true
            },
            {
                id: "c2",
                description: "Organize dietary restriction tracking form",
                assignee: "Tom Reed",
                deadline: "Mar 15",
                budget: 0,
                priority: "medium",
                done: true
            },
            {
                id: "c3",
                description: "Book coffee bar and afternoon snack stations",
                assignee: "Sarah Chen",
                deadline: "Mar 25",
                budget: 6200,
                priority: "medium",
                done: false
            }
        ]
    },
    {
        name: "Entertainment",
        icon: "musical-notes-outline",
        color: "#8b5cf6",
        tasks: [
            {
                id: "e1",
                description: "Book DJ for networking reception",
                assignee: "Alex Kim",
                deadline: "Mar 12",
                budget: 3500,
                priority: "high",
                done: true
            },
            {
                id: "e2",
                description: "Arrange photo booth and props",
                assignee: "Priya Patel",
                deadline: "Apr 05",
                budget: 1800,
                priority: "low",
                done: false
            }
        ]
    },
    {
        name: "Marketing",
        icon: "megaphone-outline",
        color: "#ec4899",
        tasks: [
            {
                id: "m1",
                description: "Launch social media campaign #TechSummit26",
                assignee: "Diana Park",
                deadline: "Mar 01",
                budget: 5000,
                priority: "high",
                done: true
            },
            {
                id: "m2",
                description: "Design and print attendee badges and lanyards",
                assignee: "Mark Rivera",
                deadline: "Mar 28",
                budget: 3200,
                priority: "medium",
                done: false
            },
            {
                id: "m3",
                description: "Send final reminder email blast to registrants",
                assignee: "Elena Voss",
                deadline: "Apr 14",
                budget: 200,
                priority: "high",
                done: false
            }
        ]
    },
    {
        name: "Speakers",
        icon: "mic-outline",
        color: "#10b981",
        tasks: [
            {
                id: "s1",
                description: "Confirm keynote speaker travel arrangements",
                assignee: "Tom Reed",
                deadline: "Mar 05",
                budget: 12000,
                priority: "high",
                done: true
            },
            {
                id: "s2",
                description: "Collect all presentation slides and run tech check",
                assignee: "Alex Kim",
                deadline: "Apr 10",
                budget: 0,
                priority: "high",
                done: false
            },
            {
                id: "s3",
                description: "Prepare speaker gift bags",
                assignee: "Diana Park",
                deadline: "Apr 12",
                budget: 1500,
                priority: "low",
                done: false
            }
        ]
    },
    {
        name: "AV & Tech",
        icon: "videocam-outline",
        color: "#06b6d4",
        tasks: [
            {
                id: "t1",
                description: "Set up livestream and recording for main stage",
                assignee: "Carlos Diaz",
                deadline: "Apr 15",
                budget: 8500,
                priority: "high",
                done: false
            },
            {
                id: "t2",
                description: "Test Wi-Fi capacity for 1,200 concurrent devices",
                assignee: "Alex Kim",
                deadline: "Apr 10",
                budget: 3000,
                priority: "high",
                done: false
            },
            {
                id: "t3",
                description: "Configure event app with schedule and maps",
                assignee: "Carlos Diaz",
                deadline: "Apr 08",
                budget: 2200,
                priority: "medium",
                done: false
            }
        ]
    }
];

// --- Helpers ---

function daysUntilEvent(): number {
    const now = new Date(2026, 2, 3); // March 3, 2026
    const event = new Date(EVENT_DATE);
    return Math.ceil((event.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function formatBudget(n: number): string {
    if (n === 0) return "$0";
    if (n >= 1000) return "$" + (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + "k";
    return "$" + n.toLocaleString("en-US");
}

function formatBudgetFull(n: number): string {
    return "$" + n.toLocaleString("en-US");
}

// --- Initials avatar ---

function Avatar({ name, color }: { name: string; color: string }) {
    const initials = name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 2);

    return (
        <View style={[avatarStyles.circle, { backgroundColor: color + "20" }]}>
            <Text style={[avatarStyles.text, { color }]}>{initials}</Text>
        </View>
    );
}

const avatarStyles = StyleSheet.create((theme) => ({
    circle: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center"
    },
    text: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 11
    }
}));

// --- Priority chip ---

function PriorityChip({ priority }: { priority: Priority }) {
    const color = PRIORITY_COLORS[priority];

    return (
        <View style={[chipStyles.container, { backgroundColor: color + "18" }]}>
            <Text style={[chipStyles.label, { color }]}>{PRIORITY_LABELS[priority]}</Text>
        </View>
    );
}

const chipStyles = StyleSheet.create((theme) => ({
    container: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10
    },
    label: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 10,
        textTransform: "uppercase",
        letterSpacing: 0.5
    }
}));

// --- Task row with checkbox ---

function TaskRow({ task, categoryColor, onToggle }: { task: Task; categoryColor: string; onToggle: () => void }) {
    const { theme } = useUnistyles();

    return (
        <View style={[taskStyles.row, { backgroundColor: theme.colors.surface }]}>
            {/* Checkbox */}
            <Pressable onPress={onToggle} style={taskStyles.checkboxArea}>
                <View
                    style={[
                        taskStyles.checkbox,
                        {
                            borderColor: task.done ? categoryColor : theme.colors.outline,
                            backgroundColor: task.done ? categoryColor : "transparent"
                        }
                    ]}
                >
                    {task.done && <Ionicons name="checkmark" size={13} color="#fff" />}
                </View>
            </Pressable>

            {/* Content */}
            <View style={taskStyles.content}>
                <Text
                    style={[
                        taskStyles.description,
                        { color: task.done ? theme.colors.onSurfaceVariant : theme.colors.onSurface },
                        task.done && taskStyles.strikethrough
                    ]}
                    numberOfLines={2}
                >
                    {task.description}
                </Text>

                {/* Meta row: assignee, deadline, budget, priority */}
                <View style={taskStyles.metaRow}>
                    <Avatar name={task.assignee} color={categoryColor} />
                    <Text style={[taskStyles.assigneeName, { color: theme.colors.onSurfaceVariant }]}>
                        {task.assignee.split(" ")[0]}
                    </Text>

                    <View style={taskStyles.metaSpacer} />

                    {/* Deadline badge */}
                    <View style={[taskStyles.deadlineBadge, { backgroundColor: theme.colors.surfaceContainer }]}>
                        <Ionicons name="calendar-outline" size={11} color={theme.colors.onSurfaceVariant} />
                        <Text style={[taskStyles.deadlineText, { color: theme.colors.onSurfaceVariant }]}>
                            {task.deadline}
                        </Text>
                    </View>

                    {/* Budget */}
                    {task.budget > 0 && (
                        <Text style={[taskStyles.budgetAmount, { color: theme.colors.onSurfaceVariant }]}>
                            {formatBudget(task.budget)}
                        </Text>
                    )}

                    <PriorityChip priority={task.priority} />
                </View>
            </View>
        </View>
    );
}

const taskStyles = StyleSheet.create((theme) => ({
    row: {
        flexDirection: "row",
        paddingVertical: 12,
        paddingHorizontal: 12,
        gap: 10,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.outlineVariant + "40"
    },
    checkboxArea: {
        paddingTop: 2
    },
    checkbox: {
        width: 20,
        height: 20,
        borderRadius: 4,
        borderWidth: 2,
        alignItems: "center",
        justifyContent: "center"
    },
    content: {
        flex: 1,
        gap: 8
    },
    description: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 14,
        lineHeight: 20
    },
    strikethrough: {
        textDecorationLine: "line-through",
        opacity: 0.6
    },
    metaRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        flexWrap: "wrap"
    },
    assigneeName: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 12
    },
    metaSpacer: {
        flex: 1
    },
    deadlineBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 3,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6
    },
    deadlineText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 11
    },
    budgetAmount: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 11
    }
}));

// --- Collapsible category section ---

function CategorySection({
    category,
    taskStates,
    onToggleTask
}: {
    category: Category;
    taskStates: Record<string, boolean>;
    onToggleTask: (id: string) => void;
}) {
    const { theme } = useUnistyles();
    const [collapsed, setCollapsed] = React.useState(false);

    const completedCount = category.tasks.filter((t) => taskStates[t.id] ?? t.done).length;
    const totalCount = category.tasks.length;
    const progress = totalCount > 0 ? completedCount / totalCount : 0;

    return (
        <View style={[sectionStyles.container, { backgroundColor: theme.colors.surfaceContainer }]}>
            {/* Section header */}
            <Pressable onPress={() => setCollapsed((c) => !c)} style={sectionStyles.header}>
                <View style={[sectionStyles.iconCircle, { backgroundColor: category.color + "20" }]}>
                    <Ionicons name={category.icon} size={18} color={category.color} />
                </View>

                <View style={sectionStyles.headerText}>
                    <Text style={[sectionStyles.categoryName, { color: theme.colors.onSurface }]}>{category.name}</Text>
                    <Text style={[sectionStyles.progressLabel, { color: theme.colors.onSurfaceVariant }]}>
                        {completedCount}/{totalCount} completed
                    </Text>
                </View>

                {/* Progress ring (simplified as bar) */}
                <View style={sectionStyles.progressBarWrap}>
                    <View
                        style={[sectionStyles.progressTrack, { backgroundColor: theme.colors.outlineVariant + "40" }]}
                    >
                        <View
                            style={[
                                sectionStyles.progressFill,
                                {
                                    width: `${progress * 100}%`,
                                    backgroundColor: category.color
                                }
                            ]}
                        />
                    </View>
                </View>

                <Ionicons
                    name={collapsed ? "chevron-forward" : "chevron-down"}
                    size={18}
                    color={theme.colors.onSurfaceVariant}
                />
            </Pressable>

            {/* Tasks */}
            {!collapsed && (
                <View style={sectionStyles.taskList}>
                    {category.tasks.map((task) => (
                        <TaskRow
                            key={task.id}
                            task={{ ...task, done: taskStates[task.id] ?? task.done }}
                            categoryColor={category.color}
                            onToggle={() => onToggleTask(task.id)}
                        />
                    ))}
                </View>
            )}
        </View>
    );
}

const sectionStyles = StyleSheet.create((theme) => ({
    container: {
        borderRadius: 12,
        overflow: "hidden"
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 14,
        paddingVertical: 12,
        gap: 10
    },
    iconCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center"
    },
    headerText: {
        flex: 1,
        gap: 2
    },
    categoryName: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 15
    },
    progressLabel: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12
    },
    progressBarWrap: {
        width: 48
    },
    progressTrack: {
        height: 4,
        borderRadius: 2,
        overflow: "hidden"
    },
    progressFill: {
        height: "100%",
        borderRadius: 2
    },
    taskList: {
        borderTopWidth: 1,
        borderTopColor: theme.colors.outlineVariant + "40"
    }
}));

// --- Budget metric card ---

function BudgetMetric({
    label,
    value,
    icon,
    iconColor
}: {
    label: string;
    value: string;
    icon: keyof typeof Ionicons.glyphMap;
    iconColor: string;
}) {
    const { theme } = useUnistyles();

    return (
        <View style={[metricStyles.card, { backgroundColor: theme.colors.surfaceContainer }]}>
            <View style={[metricStyles.iconDot, { backgroundColor: iconColor + "18" }]}>
                <Ionicons name={icon} size={18} color={iconColor} />
            </View>
            <Text style={[metricStyles.value, { color: theme.colors.onSurface }]}>{value}</Text>
            <Text style={[metricStyles.label, { color: theme.colors.onSurfaceVariant }]}>{label}</Text>
        </View>
    );
}

const metricStyles = StyleSheet.create((theme) => ({
    card: {
        flex: 1,
        borderRadius: 12,
        padding: 14,
        alignItems: "center",
        gap: 6
    },
    iconDot: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center"
    },
    value: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 18
    },
    label: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12
    }
}));

// --- Main component ---

export function EventPlanningPage() {
    const { theme } = useUnistyles();
    const countdown = daysUntilEvent();

    // Track task completion state locally
    const [taskStates, setTaskStates] = React.useState<Record<string, boolean>>(() => {
        const initial: Record<string, boolean> = {};
        for (const cat of CATEGORIES) {
            for (const task of cat.tasks) {
                initial[task.id] = task.done;
            }
        }
        return initial;
    });

    const handleToggleTask = React.useCallback((id: string) => {
        setTaskStates((prev) => ({ ...prev, [id]: !prev[id] }));
    }, []);

    // Compute overall stats
    const allTasks = CATEGORIES.flatMap((c) => c.tasks);
    const completedCount = allTasks.filter((t) => taskStates[t.id] ?? t.done).length;
    const totalTasks = allTasks.length;
    const overallProgress = totalTasks > 0 ? completedCount / totalTasks : 0;
    const spentFraction = SPENT_BUDGET / TOTAL_BUDGET;

    return (
        <ShowcasePage contentContainerStyle={{ padding: 16, gap: 20, paddingBottom: 48 }}>
            {/* Hero event card */}
            <View style={[heroStyles.card, { backgroundColor: theme.colors.primary }]}>
                <View style={heroStyles.topRow}>
                    <View style={heroStyles.eventInfo}>
                        <Text style={[heroStyles.eventName, { color: theme.colors.onPrimary }]}>{EVENT_NAME}</Text>
                        <View style={heroStyles.venueRow}>
                            <Ionicons name="location-outline" size={14} color={theme.colors.onPrimary + "B0"} />
                            <Text style={[heroStyles.venue, { color: theme.colors.onPrimary + "B0" }]}>
                                {EVENT_VENUE}
                            </Text>
                        </View>
                        <View style={heroStyles.dateRow}>
                            <Ionicons name="calendar-outline" size={14} color={theme.colors.onPrimary + "B0"} />
                            <Text style={[heroStyles.dateText, { color: theme.colors.onPrimary + "B0" }]}>
                                April 18, 2026
                            </Text>
                        </View>
                    </View>

                    {/* Large countdown */}
                    <View style={[heroStyles.countdownCircle, { backgroundColor: theme.colors.onPrimary + "20" }]}>
                        <Text style={[heroStyles.countdownNumber, { color: theme.colors.onPrimary }]}>{countdown}</Text>
                        <Text style={[heroStyles.countdownLabel, { color: theme.colors.onPrimary + "B0" }]}>days</Text>
                    </View>
                </View>

                {/* Overall progress bar */}
                <View style={heroStyles.progressSection}>
                    <View style={heroStyles.progressHeader}>
                        <Text style={[heroStyles.progressTitle, { color: theme.colors.onPrimary + "D0" }]}>
                            Task Progress
                        </Text>
                        <Text style={[heroStyles.progressPercent, { color: theme.colors.onPrimary }]}>
                            {Math.round(overallProgress * 100)}%
                        </Text>
                    </View>
                    <View style={[heroStyles.progressTrack, { backgroundColor: theme.colors.onPrimary + "30" }]}>
                        <View
                            style={[
                                heroStyles.progressFill,
                                {
                                    width: `${overallProgress * 100}%`,
                                    backgroundColor: theme.colors.onPrimary
                                }
                            ]}
                        />
                    </View>
                    <Text style={[heroStyles.progressSubtext, { color: theme.colors.onPrimary + "90" }]}>
                        {completedCount} of {totalTasks} tasks completed
                    </Text>
                </View>
            </View>

            {/* Category task sections */}
            {CATEGORIES.map((category) => (
                <CategorySection
                    key={category.name}
                    category={category}
                    taskStates={taskStates}
                    onToggleTask={handleToggleTask}
                />
            ))}

            {/* Budget summary section */}
            <View style={budgetStyles.wrapper}>
                <View style={budgetStyles.titleRow}>
                    <Ionicons name="wallet-outline" size={20} color={theme.colors.onSurface} />
                    <Text style={[budgetStyles.title, { color: theme.colors.onSurface }]}>Budget Summary</Text>
                </View>

                {/* Three metric cards */}
                <View style={budgetStyles.metricsRow}>
                    <BudgetMetric
                        label="Total Budget"
                        value={formatBudgetFull(TOTAL_BUDGET)}
                        icon="cash-outline"
                        iconColor="#3b82f6"
                    />
                    <BudgetMetric
                        label="Spent"
                        value={formatBudgetFull(SPENT_BUDGET)}
                        icon="trending-down-outline"
                        iconColor="#ef4444"
                    />
                    <BudgetMetric
                        label="Remaining"
                        value={formatBudgetFull(REMAINING_BUDGET)}
                        icon="shield-checkmark-outline"
                        iconColor="#22c55e"
                    />
                </View>

                {/* Budget progress bar */}
                <View style={[budgetStyles.barCard, { backgroundColor: theme.colors.surfaceContainer }]}>
                    <View style={budgetStyles.barHeader}>
                        <Text style={[budgetStyles.barLabel, { color: theme.colors.onSurfaceVariant }]}>
                            Budget Utilization
                        </Text>
                        <Text style={[budgetStyles.barPercent, { color: theme.colors.onSurface }]}>
                            {Math.round(spentFraction * 100)}%
                        </Text>
                    </View>
                    <View style={[budgetStyles.barTrack, { backgroundColor: theme.colors.outlineVariant + "40" }]}>
                        <View
                            style={[
                                budgetStyles.barSpent,
                                {
                                    width: `${spentFraction * 100}%`,
                                    backgroundColor: spentFraction > 0.9 ? "#ef4444" : "#f59e0b"
                                }
                            ]}
                        />
                        <View
                            style={[
                                budgetStyles.barRemaining,
                                {
                                    width: `${(1 - spentFraction) * 100}%`,
                                    backgroundColor: "#22c55e60"
                                }
                            ]}
                        />
                    </View>
                    <View style={budgetStyles.barLegend}>
                        <View style={budgetStyles.legendItem}>
                            <View style={[budgetStyles.legendDot, { backgroundColor: "#f59e0b" }]} />
                            <Text style={[budgetStyles.legendText, { color: theme.colors.onSurfaceVariant }]}>
                                Spent
                            </Text>
                        </View>
                        <View style={budgetStyles.legendItem}>
                            <View style={[budgetStyles.legendDot, { backgroundColor: "#22c55e60" }]} />
                            <Text style={[budgetStyles.legendText, { color: theme.colors.onSurfaceVariant }]}>
                                Remaining
                            </Text>
                        </View>
                    </View>
                </View>
            </View>
        </ShowcasePage>
    );
}

// --- Hero styles ---

const heroStyles = StyleSheet.create((theme) => ({
    card: {
        borderRadius: 16,
        padding: 20,
        gap: 18
    },
    topRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 12
    },
    eventInfo: {
        flex: 1,
        gap: 6
    },
    eventName: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 24,
        lineHeight: 30
    },
    venueRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4
    },
    venue: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13,
        lineHeight: 18,
        flex: 1
    },
    dateRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4
    },
    dateText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 13
    },
    countdownCircle: {
        width: 76,
        height: 76,
        borderRadius: 38,
        alignItems: "center",
        justifyContent: "center"
    },
    countdownNumber: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 32,
        lineHeight: 36
    },
    countdownLabel: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12,
        marginTop: -2
    },
    progressSection: {
        gap: 6
    },
    progressHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center"
    },
    progressTitle: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 13
    },
    progressPercent: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 14
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
    progressSubtext: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12
    }
}));

// --- Budget styles ---

const budgetStyles = StyleSheet.create((theme) => ({
    wrapper: {
        gap: 14
    },
    titleRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8
    },
    title: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 18
    },
    metricsRow: {
        flexDirection: "row",
        gap: 10
    },
    barCard: {
        borderRadius: 12,
        padding: 14,
        gap: 10
    },
    barHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center"
    },
    barLabel: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 13
    },
    barPercent: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 14
    },
    barTrack: {
        height: 12,
        borderRadius: 6,
        overflow: "hidden",
        flexDirection: "row"
    },
    barSpent: {
        height: "100%"
    },
    barRemaining: {
        height: "100%"
    },
    barLegend: {
        flexDirection: "row",
        gap: 16
    },
    legendItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6
    },
    legendDot: {
        width: 8,
        height: 8,
        borderRadius: 4
    },
    legendText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12
    }
}));
