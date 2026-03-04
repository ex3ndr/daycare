import { Ionicons } from "@expo/vector-icons";
import * as React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

// --- Types ---

type MuscleGroup = "chest" | "back" | "shoulders" | "legs" | "arms" | "core";

type ExerciseSet = {
    reps: number;
    weight: number;
};

type Exercise = {
    id: string;
    name: string;
    muscleGroup: MuscleGroup;
    sets: number;
    reps: number;
    weight: number;
    previousSession: ExerciseSet;
    completed: boolean;
    isPR: boolean;
};

type SummaryStats = {
    totalVolume: number;
    estimatedDuration: number;
    prsHit: number;
};

// --- Mock Data ---

const MUSCLE_GROUP_ICONS: Record<MuscleGroup, keyof typeof Ionicons.glyphMap> = {
    chest: "body-outline",
    back: "arrow-back-outline",
    shoulders: "triangle-outline",
    legs: "walk-outline",
    arms: "fitness-outline",
    core: "ellipse-outline"
};

const MUSCLE_GROUP_LABELS: Record<MuscleGroup, string> = {
    chest: "Chest",
    back: "Back",
    shoulders: "Shoulders",
    legs: "Legs",
    arms: "Arms",
    core: "Core"
};

const initialExercises: Exercise[] = [
    {
        id: "1",
        name: "Barbell Bench Press",
        muscleGroup: "chest",
        sets: 4,
        reps: 8,
        weight: 185,
        previousSession: { reps: 8, weight: 180 },
        completed: false,
        isPR: true
    },
    {
        id: "2",
        name: "Incline Dumbbell Press",
        muscleGroup: "chest",
        sets: 3,
        reps: 10,
        weight: 65,
        previousSession: { reps: 10, weight: 60 },
        completed: false,
        isPR: false
    },
    {
        id: "3",
        name: "Cable Flyes",
        muscleGroup: "chest",
        sets: 3,
        reps: 12,
        weight: 30,
        previousSession: { reps: 12, weight: 30 },
        completed: false,
        isPR: false
    },
    {
        id: "4",
        name: "Overhead Press",
        muscleGroup: "shoulders",
        sets: 4,
        reps: 8,
        weight: 115,
        previousSession: { reps: 8, weight: 110 },
        completed: false,
        isPR: true
    },
    {
        id: "5",
        name: "Lateral Raises",
        muscleGroup: "shoulders",
        sets: 3,
        reps: 15,
        weight: 20,
        previousSession: { reps: 15, weight: 20 },
        completed: false,
        isPR: false
    },
    {
        id: "6",
        name: "Tricep Pushdowns",
        muscleGroup: "arms",
        sets: 3,
        reps: 12,
        weight: 55,
        previousSession: { reps: 12, weight: 50 },
        completed: false,
        isPR: true
    },
    {
        id: "7",
        name: "Barbell Curls",
        muscleGroup: "arms",
        sets: 3,
        reps: 10,
        weight: 75,
        previousSession: { reps: 10, weight: 75 },
        completed: false,
        isPR: false
    },
    {
        id: "8",
        name: "Hanging Leg Raises",
        muscleGroup: "core",
        sets: 3,
        reps: 15,
        weight: 0,
        previousSession: { reps: 12, weight: 0 },
        completed: false,
        isPR: false
    }
];

// --- Helpers ---

function computeStats(exercises: Exercise[]): SummaryStats {
    let totalVolume = 0;
    let prsHit = 0;
    for (const ex of exercises) {
        totalVolume += ex.sets * ex.reps * ex.weight;
        if (ex.isPR && ex.completed) {
            prsHit++;
        }
    }
    // Rough estimate: ~3 min per set including rest
    const totalSets = exercises.reduce((sum, ex) => sum + ex.sets, 0);
    const estimatedDuration = Math.round(totalSets * 3);
    return { totalVolume, estimatedDuration, prsHit };
}

function formatVolume(volume: number): string {
    if (volume >= 1000) {
        return `${(volume / 1000).toFixed(1)}k`;
    }
    return `${volume}`;
}

function groupByMuscle(exercises: Exercise[]): [MuscleGroup, Exercise[]][] {
    const groups = new Map<MuscleGroup, Exercise[]>();
    for (const ex of exercises) {
        const list = groups.get(ex.muscleGroup);
        if (list) {
            list.push(ex);
        } else {
            groups.set(ex.muscleGroup, [ex]);
        }
    }
    return Array.from(groups.entries());
}

// --- PR Badge ---

function PRBadge({ color, bgColor }: { color: string; bgColor: string }) {
    return (
        <View style={[styles.prBadge, { backgroundColor: bgColor }]}>
            <Ionicons name="trophy" size={10} color={color} />
            <Text style={[styles.prBadgeText, { color }]}>PR</Text>
        </View>
    );
}

// --- Workout Header ---

function WorkoutHeader({
    completedCount,
    totalCount,
    duration
}: {
    completedCount: number;
    totalCount: number;
    duration: number;
}) {
    const { theme } = useUnistyles();
    const progressPct = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

    return (
        <View style={[styles.headerCard, { backgroundColor: theme.colors.primary }]}>
            <View style={styles.headerTopRow}>
                <View style={styles.headerDayBadge}>
                    <Text style={[styles.headerDayText, { color: theme.colors.primary }]}>DAY 24</Text>
                </View>
                <View style={styles.headerTimeRow}>
                    <Ionicons name="time-outline" size={16} color={theme.colors.onPrimary} />
                    <Text style={[styles.headerTimeText, { color: theme.colors.onPrimary }]}>~{duration} min</Text>
                </View>
            </View>

            <Text style={[styles.headerTitle, { color: theme.colors.onPrimary }]}>Push Day</Text>
            <Text style={[styles.headerSubtitle, { color: `${theme.colors.onPrimary}BB` }]}>
                Chest, Shoulders & Arms
            </Text>

            {/* Progress bar */}
            <View style={styles.headerProgressContainer}>
                <View style={[styles.headerProgressTrack, { backgroundColor: `${theme.colors.onPrimary}30` }]}>
                    <View
                        style={[
                            styles.headerProgressFill,
                            {
                                width: `${progressPct}%`,
                                backgroundColor: theme.colors.onPrimary
                            }
                        ]}
                    />
                </View>
                <Text style={[styles.headerProgressLabel, { color: `${theme.colors.onPrimary}CC` }]}>
                    {completedCount}/{totalCount} exercises
                </Text>
            </View>
        </View>
    );
}

// --- Muscle Group Section ---

function MuscleGroupDivider({ muscleGroup }: { muscleGroup: MuscleGroup }) {
    const { theme } = useUnistyles();

    return (
        <View style={styles.sectionDivider}>
            <View style={[styles.sectionDividerLine, { backgroundColor: theme.colors.outlineVariant }]} />
            <View style={[styles.sectionDividerPill, { backgroundColor: theme.colors.surfaceContainer }]}>
                <Ionicons name={MUSCLE_GROUP_ICONS[muscleGroup]} size={14} color={theme.colors.onSurfaceVariant} />
                <Text style={[styles.sectionDividerText, { color: theme.colors.onSurfaceVariant }]}>
                    {MUSCLE_GROUP_LABELS[muscleGroup]}
                </Text>
            </View>
            <View style={[styles.sectionDividerLine, { backgroundColor: theme.colors.outlineVariant }]} />
        </View>
    );
}

// --- Exercise Card ---

function ExerciseCard({ exercise, onToggle }: { exercise: Exercise; onToggle: () => void }) {
    const { theme } = useUnistyles();

    const prevLabel =
        exercise.previousSession.weight > 0
            ? `${exercise.previousSession.reps} reps @ ${exercise.previousSession.weight} lbs`
            : `${exercise.previousSession.reps} reps (bodyweight)`;

    const weightDiff = exercise.weight - exercise.previousSession.weight;
    const repsDiff = exercise.reps - exercise.previousSession.reps;

    return (
        <Pressable
            onPress={onToggle}
            style={({ pressed }) => [
                styles.exerciseCard,
                {
                    backgroundColor: exercise.completed ? `${theme.colors.primary}0A` : theme.colors.surfaceContainer,
                    borderColor: exercise.completed ? theme.colors.primary : theme.colors.outlineVariant,
                    opacity: pressed ? 0.85 : 1
                }
            ]}
        >
            {/* Top row: checkbox + name + PR badge */}
            <View style={styles.exerciseTopRow}>
                <View
                    style={[
                        styles.checkbox,
                        {
                            borderColor: exercise.completed ? theme.colors.primary : theme.colors.outline,
                            backgroundColor: exercise.completed ? theme.colors.primary : "transparent"
                        }
                    ]}
                >
                    {exercise.completed && <Ionicons name="checkmark" size={14} color={theme.colors.onPrimary} />}
                </View>
                <Text
                    style={[
                        styles.exerciseName,
                        {
                            color: exercise.completed ? theme.colors.primary : theme.colors.onSurface,
                            textDecorationLine: exercise.completed ? "line-through" : "none"
                        }
                    ]}
                    numberOfLines={1}
                >
                    {exercise.name}
                </Text>
                {exercise.isPR && <PRBadge color={theme.colors.tertiary} bgColor={`${theme.colors.tertiary}18`} />}
            </View>

            {/* Sets/Reps/Weight row */}
            <View style={styles.metricsRow}>
                <View style={[styles.metricPill, { backgroundColor: theme.colors.surfaceContainerHighest }]}>
                    <Ionicons name="repeat-outline" size={13} color={theme.colors.onSurfaceVariant} />
                    <Text style={[styles.metricValue, { color: theme.colors.onSurface }]}>{exercise.sets} sets</Text>
                </View>
                <View style={[styles.metricPill, { backgroundColor: theme.colors.surfaceContainerHighest }]}>
                    <Ionicons name="sync-outline" size={13} color={theme.colors.onSurfaceVariant} />
                    <Text style={[styles.metricValue, { color: theme.colors.onSurface }]}>{exercise.reps} reps</Text>
                </View>
                {exercise.weight > 0 && (
                    <View style={[styles.metricPill, { backgroundColor: theme.colors.surfaceContainerHighest }]}>
                        <Ionicons name="barbell-outline" size={13} color={theme.colors.onSurfaceVariant} />
                        <Text style={[styles.metricValue, { color: theme.colors.onSurface }]}>
                            {exercise.weight} lbs
                        </Text>
                    </View>
                )}
            </View>

            {/* Previous session subtitle */}
            <View style={styles.previousRow}>
                <Ionicons name="arrow-undo-outline" size={12} color={theme.colors.onSurfaceVariant} />
                <Text style={[styles.previousText, { color: theme.colors.onSurfaceVariant }]}>
                    Previous: {prevLabel}
                </Text>
                {(weightDiff > 0 || repsDiff > 0) && (
                    <View style={[styles.diffBadge, { backgroundColor: `${theme.colors.primary}18` }]}>
                        <Ionicons name="arrow-up" size={10} color={theme.colors.primary} />
                        <Text style={[styles.diffText, { color: theme.colors.primary }]}>
                            {weightDiff > 0 ? `+${weightDiff} lbs` : `+${repsDiff} reps`}
                        </Text>
                    </View>
                )}
            </View>
        </Pressable>
    );
}

// --- Summary Section ---

function SummarySection({
    stats,
    completedCount,
    totalCount
}: {
    stats: SummaryStats;
    completedCount: number;
    totalCount: number;
}) {
    const { theme } = useUnistyles();

    return (
        <View style={styles.summaryContainer}>
            <Text style={[styles.summaryTitle, { color: theme.colors.onSurface }]}>Workout Summary</Text>

            <View style={styles.summaryGrid}>
                {/* Volume card */}
                <View style={[styles.summaryCard, { backgroundColor: theme.colors.surfaceContainer }]}>
                    <View style={[styles.summaryIconCircle, { backgroundColor: `${theme.colors.primary}18` }]}>
                        <Ionicons name="barbell-outline" size={20} color={theme.colors.primary} />
                    </View>
                    <Text style={[styles.summaryCardValue, { color: theme.colors.onSurface }]}>
                        {formatVolume(stats.totalVolume)}
                    </Text>
                    <Text style={[styles.summaryCardLabel, { color: theme.colors.onSurfaceVariant }]}>
                        Total Volume (lbs)
                    </Text>
                </View>

                {/* Duration card */}
                <View style={[styles.summaryCard, { backgroundColor: theme.colors.surfaceContainer }]}>
                    <View style={[styles.summaryIconCircle, { backgroundColor: `${theme.colors.secondary}18` }]}>
                        <Ionicons name="time-outline" size={20} color={theme.colors.secondary} />
                    </View>
                    <Text style={[styles.summaryCardValue, { color: theme.colors.onSurface }]}>
                        {stats.estimatedDuration}
                    </Text>
                    <Text style={[styles.summaryCardLabel, { color: theme.colors.onSurfaceVariant }]}>
                        Est. Minutes
                    </Text>
                </View>

                {/* PRs card */}
                <View style={[styles.summaryCard, { backgroundColor: theme.colors.surfaceContainer }]}>
                    <View style={[styles.summaryIconCircle, { backgroundColor: `${theme.colors.tertiary}18` }]}>
                        <Ionicons name="trophy-outline" size={20} color={theme.colors.tertiary} />
                    </View>
                    <Text style={[styles.summaryCardValue, { color: theme.colors.onSurface }]}>{stats.prsHit}</Text>
                    <Text style={[styles.summaryCardLabel, { color: theme.colors.onSurfaceVariant }]}>PRs Hit</Text>
                    {stats.prsHit > 0 && (
                        <View style={[styles.prCountBadge, { backgroundColor: `${theme.colors.tertiary}18` }]}>
                            <Ionicons name="flame" size={10} color={theme.colors.tertiary} />
                            <Text style={[styles.prCountText, { color: theme.colors.tertiary }]}>New!</Text>
                        </View>
                    )}
                </View>

                {/* Completion card */}
                <View style={[styles.summaryCard, { backgroundColor: theme.colors.surfaceContainer }]}>
                    <View style={[styles.summaryIconCircle, { backgroundColor: `${theme.colors.error}18` }]}>
                        <Ionicons name="checkmark-done-outline" size={20} color={theme.colors.error} />
                    </View>
                    <Text style={[styles.summaryCardValue, { color: theme.colors.onSurface }]}>
                        {completedCount}/{totalCount}
                    </Text>
                    <Text style={[styles.summaryCardLabel, { color: theme.colors.onSurfaceVariant }]}>Completed</Text>
                </View>
            </View>
        </View>
    );
}

// --- Main Component ---

export function GymWorkoutPage() {
    const { theme } = useUnistyles();
    const [exercises, setExercises] = React.useState(initialExercises);

    const toggleExercise = React.useCallback((id: string) => {
        setExercises((prev) => prev.map((ex) => (ex.id === id ? { ...ex, completed: !ex.completed } : ex)));
    }, []);

    const completedCount = exercises.filter((ex) => ex.completed).length;
    const totalCount = exercises.length;
    const stats = React.useMemo(() => computeStats(exercises), [exercises]);
    const grouped = React.useMemo(() => groupByMuscle(exercises), [exercises]);

    return (
        <ScrollView
            style={{ flex: 1, backgroundColor: theme.colors.surface }}
            contentContainerStyle={styles.scrollContent}
        >
            {/* Workout header */}
            <WorkoutHeader completedCount={completedCount} totalCount={totalCount} duration={stats.estimatedDuration} />

            {/* Exercise list grouped by muscle */}
            <View style={styles.exerciseList}>
                {grouped.map(([muscleGroup, groupExercises]) => (
                    <View key={muscleGroup} style={styles.muscleGroupSection}>
                        <MuscleGroupDivider muscleGroup={muscleGroup} />
                        <View style={styles.exerciseGroupCards}>
                            {groupExercises.map((exercise) => (
                                <ExerciseCard
                                    key={exercise.id}
                                    exercise={exercise}
                                    onToggle={() => toggleExercise(exercise.id)}
                                />
                            ))}
                        </View>
                    </View>
                ))}
            </View>

            {/* Summary */}
            <SummarySection stats={stats} completedCount={completedCount} totalCount={totalCount} />
        </ScrollView>
    );
}

// --- Styles ---

const styles = StyleSheet.create((_theme) => ({
    scrollContent: {
        maxWidth: 600,
        width: "100%",
        alignSelf: "center",
        paddingHorizontal: 16,
        paddingBottom: 48
    },

    // Header card
    headerCard: {
        borderRadius: 20,
        padding: 24,
        marginTop: 16,
        gap: 4
    },
    headerTopRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12
    },
    headerDayBadge: {
        backgroundColor: "rgba(255,255,255,0.95)",
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8
    },
    headerDayText: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 11,
        fontWeight: "700",
        letterSpacing: 1
    },
    headerTimeRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4
    },
    headerTimeText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 14
    },
    headerTitle: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 32,
        letterSpacing: -0.5
    },
    headerSubtitle: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 15,
        marginBottom: 16
    },
    headerProgressContainer: {
        gap: 6
    },
    headerProgressTrack: {
        height: 6,
        borderRadius: 3,
        overflow: "hidden"
    },
    headerProgressFill: {
        height: "100%",
        borderRadius: 3
    },
    headerProgressLabel: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 12
    },

    // Exercise list
    exerciseList: {
        marginTop: 24,
        gap: 8
    },
    muscleGroupSection: {
        gap: 8
    },
    exerciseGroupCards: {
        gap: 10
    },

    // Section divider
    sectionDivider: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        marginTop: 12,
        marginBottom: 4
    },
    sectionDividerLine: {
        flex: 1,
        height: 1
    },
    sectionDividerPill: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 12
    },
    sectionDividerText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 12,
        letterSpacing: 0.5,
        textTransform: "uppercase"
    },

    // Exercise card
    exerciseCard: {
        borderRadius: 14,
        borderWidth: 1,
        padding: 14,
        gap: 10
    },
    exerciseTopRow: {
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
    exerciseName: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 15,
        flex: 1
    },

    // PR Badge
    prBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 3,
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 8
    },
    prBadgeText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 10,
        letterSpacing: 0.5
    },

    // Metrics row
    metricsRow: {
        flexDirection: "row",
        gap: 8,
        marginLeft: 32
    },
    metricPill: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8
    },
    metricValue: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 12
    },

    // Previous session row
    previousRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        marginLeft: 32
    },
    previousText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12
    },
    diffBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 2,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6
    },
    diffText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 10
    },

    // Summary
    summaryContainer: {
        marginTop: 32,
        gap: 14
    },
    summaryTitle: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 18
    },
    summaryGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 10
    },
    summaryCard: {
        flexBasis: "47%",
        flexGrow: 1,
        borderRadius: 16,
        padding: 16,
        alignItems: "center",
        gap: 6,
        position: "relative"
    },
    summaryIconCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "center"
    },
    summaryCardValue: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 24
    },
    summaryCardLabel: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12,
        textAlign: "center"
    },
    prCountBadge: {
        position: "absolute",
        top: 10,
        right: 10,
        flexDirection: "row",
        alignItems: "center",
        gap: 3,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8
    },
    prCountText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 10
    }
}));
