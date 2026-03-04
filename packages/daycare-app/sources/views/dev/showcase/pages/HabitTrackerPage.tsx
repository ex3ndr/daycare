import { Ionicons } from "@expo/vector-icons";
import * as React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

// --- Types ---

type TimeOfDay = "morning" | "afternoon" | "evening";

type Habit = {
    id: string;
    name: string;
    icon: keyof typeof Ionicons.glyphMap;
    completed: boolean;
    streak: number;
    timeOfDay: TimeOfDay;
};

// --- Mock data ---

const initialHabits: Habit[] = [
    { id: "1", name: "Meditate", icon: "leaf-outline", completed: true, streak: 14, timeOfDay: "morning" },
    { id: "2", name: "Run", icon: "fitness-outline", completed: true, streak: 7, timeOfDay: "morning" },
    { id: "3", name: "Read", icon: "book-outline", completed: true, streak: 21, timeOfDay: "morning" },
    { id: "4", name: "Eat Well", icon: "nutrition-outline", completed: true, streak: 5, timeOfDay: "morning" },
    { id: "5", name: "Guitar", icon: "musical-notes-outline", completed: false, streak: 3, timeOfDay: "morning" },
    { id: "6", name: "Walk", icon: "walk-outline", completed: true, streak: 12, timeOfDay: "afternoon" },
    { id: "7", name: "Spanish", icon: "school-outline", completed: true, streak: 30, timeOfDay: "afternoon" },
    { id: "8", name: "No Sugar", icon: "close-circle-outline", completed: false, streak: 0, timeOfDay: "afternoon" },
    { id: "9", name: "Stretch", icon: "body-outline", completed: true, streak: 9, timeOfDay: "afternoon" },
    { id: "10", name: "Journal", icon: "pencil-outline", completed: false, streak: 2, timeOfDay: "evening" },
    { id: "11", name: "Read", icon: "moon-outline", completed: false, streak: 18, timeOfDay: "evening" },
    { id: "12", name: "No Screens", icon: "phone-portrait-outline", completed: false, streak: 0, timeOfDay: "evening" }
];

const TIME_DOT_COLORS: Record<TimeOfDay, string> = {
    morning: "#F59E0B",
    afternoon: "#3B82F6",
    evening: "#8B5CF6"
};

// --- Progress Ring ---

function ProgressRing({
    completed,
    total,
    size,
    strokeWidth,
    color,
    trackColor
}: {
    completed: number;
    total: number;
    size: number;
    strokeWidth: number;
    color: string;
    trackColor: string;
}) {
    // Build a circular progress ring using 60 small segments arranged in a circle.
    const segmentCount = 60;
    const radius = (size - strokeWidth) / 2;
    const center = size / 2;
    const filledSegments = total > 0 ? Math.round((completed / total) * segmentCount) : 0;
    const segmentSize = strokeWidth * 0.8;

    const segments = [];
    for (let i = 0; i < segmentCount; i++) {
        const angle = (i / segmentCount) * 2 * Math.PI - Math.PI / 2;
        const x = center + radius * Math.cos(angle) - segmentSize / 2;
        const y = center + radius * Math.sin(angle) - segmentSize / 2;
        const isFilled = i < filledSegments;

        segments.push(
            <View
                key={i}
                style={{
                    position: "absolute",
                    left: x,
                    top: y,
                    width: segmentSize,
                    height: segmentSize,
                    borderRadius: segmentSize / 2,
                    backgroundColor: isFilled ? color : trackColor
                }}
            />
        );
    }

    return (
        <View style={{ width: size, height: size, alignSelf: "center" }}>
            {segments}
            <View
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    justifyContent: "center",
                    alignItems: "center"
                }}
            >
                <Text
                    style={{
                        fontFamily: "IBMPlexSans-SemiBold",
                        fontSize: size * 0.22,
                        color: color
                    }}
                >
                    {completed}/{total}
                </Text>
            </View>
        </View>
    );
}

// --- Streak Bar ---

function StreakBar({
    name,
    streak,
    maxStreak,
    color,
    textColor
}: {
    name: string;
    streak: number;
    maxStreak: number;
    color: string;
    textColor: string;
}) {
    const pct = maxStreak > 0 ? (streak / maxStreak) * 100 : 0;

    return (
        <View style={{ gap: 4 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontFamily: "IBMPlexSans-Medium", fontSize: 13, color: textColor }}>{name}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                    <Ionicons name="flame" size={13} color={color} />
                    <Text style={{ fontFamily: "IBMPlexSans-SemiBold", fontSize: 13, color }}>{streak}d</Text>
                </View>
            </View>
            <View
                style={{
                    height: 8,
                    backgroundColor: `${color}20`,
                    borderRadius: 4,
                    overflow: "hidden"
                }}
            >
                <View
                    style={{
                        width: `${pct}%`,
                        height: "100%",
                        backgroundColor: color,
                        borderRadius: 4
                    }}
                />
            </View>
        </View>
    );
}

// --- Main Component ---

export function HabitTrackerPage() {
    const { theme } = useUnistyles();
    const [habits, setHabits] = React.useState(initialHabits);

    const completedCount = habits.filter((h) => h.completed).length;
    const totalCount = habits.length;

    const toggleHabit = React.useCallback((id: string) => {
        setHabits((prev) => prev.map((h) => (h.id === id ? { ...h, completed: !h.completed } : h)));
    }, []);

    // Top 3 habits by streak for the leaders section
    const streakLeaders = React.useMemo(
        () =>
            [...habits]
                .filter((h) => h.streak > 0)
                .sort((a, b) => b.streak - a.streak)
                .slice(0, 3),
        [habits]
    );
    const maxStreak = streakLeaders.length > 0 ? streakLeaders[0].streak : 1;

    return (
        <ScrollView
            contentContainerStyle={{
                maxWidth: 600,
                width: "100%",
                alignSelf: "center",
                paddingHorizontal: 16,
                paddingBottom: 40
            }}
        >
            {/* --- Top section: Progress ring + date --- */}
            <View style={styles.ringSection}>
                <ProgressRing
                    completed={completedCount}
                    total={totalCount}
                    size={140}
                    strokeWidth={10}
                    color={theme.colors.primary}
                    trackColor={theme.colors.outlineVariant}
                />
                <Text style={[styles.dateLabel, { color: theme.colors.onSurface }]}>Tuesday, March 3</Text>
                <Text style={[styles.dateSubLabel, { color: theme.colors.onSurfaceVariant }]}>
                    {completedCount === totalCount
                        ? "All habits completed!"
                        : `${totalCount - completedCount} remaining today`}
                </Text>
            </View>

            {/* --- Habit grid --- */}
            <View style={styles.grid}>
                {habits.map((habit) => {
                    const dotColor = TIME_DOT_COLORS[habit.timeOfDay];

                    return (
                        <Pressable
                            key={habit.id}
                            onPress={() => toggleHabit(habit.id)}
                            style={({ pressed }) => [
                                styles.card,
                                {
                                    backgroundColor: habit.completed
                                        ? `${theme.colors.primary}14`
                                        : theme.colors.surfaceContainer,
                                    borderColor: habit.completed ? theme.colors.primary : theme.colors.outlineVariant,
                                    opacity: pressed ? 0.8 : 1
                                }
                            ]}
                        >
                            {/* Time-of-day dot in top-right */}
                            <View style={[styles.timeDot, { backgroundColor: dotColor }]} />

                            {/* Checkmark overlay */}
                            {habit.completed && (
                                <View style={styles.checkOverlay}>
                                    <Ionicons name="checkmark-circle" size={22} color={theme.colors.primary} />
                                </View>
                            )}

                            {/* Icon */}
                            <View
                                style={[
                                    styles.iconCircle,
                                    {
                                        backgroundColor: habit.completed
                                            ? `${theme.colors.primary}20`
                                            : theme.colors.surfaceContainerHighest
                                    }
                                ]}
                            >
                                <Ionicons
                                    name={habit.icon}
                                    size={24}
                                    color={habit.completed ? theme.colors.primary : theme.colors.onSurfaceVariant}
                                />
                            </View>

                            {/* Habit name */}
                            <Text
                                style={[
                                    styles.habitName,
                                    {
                                        color: habit.completed ? theme.colors.primary : theme.colors.onSurface
                                    }
                                ]}
                                numberOfLines={1}
                            >
                                {habit.name}
                            </Text>

                            {/* Streak at bottom */}
                            <View style={styles.streakRow}>
                                <Ionicons
                                    name="flame"
                                    size={14}
                                    color={habit.streak > 0 ? theme.colors.error : theme.colors.outlineVariant}
                                />
                                <Text
                                    style={[
                                        styles.streakText,
                                        {
                                            color: habit.streak > 0 ? theme.colors.error : theme.colors.outlineVariant
                                        }
                                    ]}
                                >
                                    {habit.streak}d
                                </Text>
                            </View>
                        </Pressable>
                    );
                })}
            </View>

            {/* --- Streak Leaders --- */}
            {streakLeaders.length > 0 && (
                <View
                    style={[
                        styles.leadersCard,
                        {
                            backgroundColor: theme.colors.surfaceContainer,
                            borderColor: theme.colors.outlineVariant
                        }
                    ]}
                >
                    <View style={styles.leadersHeader}>
                        <Ionicons name="trophy" size={18} color={theme.colors.tertiary} />
                        <Text style={[styles.leadersTitle, { color: theme.colors.onSurface }]}>Streak Leaders</Text>
                    </View>
                    <View style={styles.leadersContent}>
                        {streakLeaders.map((habit, index) => (
                            <StreakBar
                                key={habit.id}
                                name={habit.name}
                                streak={habit.streak}
                                maxStreak={maxStreak}
                                color={
                                    index === 0
                                        ? theme.colors.tertiary
                                        : index === 1
                                          ? theme.colors.primary
                                          : theme.colors.onSurfaceVariant
                                }
                                textColor={theme.colors.onSurface}
                            />
                        ))}
                    </View>

                    {/* Legend for time-of-day dots */}
                    <View style={styles.legend}>
                        {(["morning", "afternoon", "evening"] as TimeOfDay[]).map((tod) => (
                            <View key={tod} style={styles.legendItem}>
                                <View style={[styles.legendDot, { backgroundColor: TIME_DOT_COLORS[tod] }]} />
                                <Text style={[styles.legendText, { color: theme.colors.onSurfaceVariant }]}>
                                    {tod.charAt(0).toUpperCase() + tod.slice(1)}
                                </Text>
                            </View>
                        ))}
                    </View>
                </View>
            )}
        </ScrollView>
    );
}

// --- Styles ---

const styles = StyleSheet.create((_theme) => ({
    ringSection: {
        alignItems: "center",
        paddingTop: 32,
        paddingBottom: 24,
        gap: 8
    },
    dateLabel: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 20,
        marginTop: 12
    },
    dateSubLabel: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 14
    },
    grid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 12
    },
    card: {
        width: "48%",
        flexGrow: 1,
        flexBasis: "45%",
        aspectRatio: 1,
        borderRadius: 16,
        borderWidth: 1,
        padding: 14,
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        position: "relative",
        overflow: "hidden"
    },
    timeDot: {
        position: "absolute",
        top: 10,
        right: 10,
        width: 8,
        height: 8,
        borderRadius: 4
    },
    checkOverlay: {
        position: "absolute",
        top: 10,
        left: 10
    },
    iconCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: "center",
        justifyContent: "center"
    },
    habitName: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 14,
        textAlign: "center"
    },
    streakRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 3
    },
    streakText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 13
    },
    leadersCard: {
        marginTop: 24,
        borderRadius: 16,
        borderWidth: 1,
        padding: 16,
        gap: 16
    },
    leadersHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8
    },
    leadersTitle: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 16
    },
    leadersContent: {
        gap: 12
    },
    legend: {
        flexDirection: "row",
        justifyContent: "center",
        gap: 16,
        paddingTop: 4
    },
    legendItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5
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
