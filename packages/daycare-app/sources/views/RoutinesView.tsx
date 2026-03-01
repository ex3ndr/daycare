import { useEffect, useMemo } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { Item } from "@/components/Item";
import { ItemGroup } from "@/components/ItemGroup";
import { ItemListStatic } from "@/components/ItemList";
import { useAuthStore } from "@/modules/auth/authContext";
import { useTasksStore } from "@/modules/tasks/tasksContext";
import { tasksFormatLastRun } from "@/modules/tasks/tasksFormatLastRun";
import { tasksStatus } from "@/modules/tasks/tasksStatus";
import { tasksSubtitle } from "@/modules/tasks/tasksSubtitle";
import type { TaskStatus } from "@/modules/tasks/tasksTypes";

function RoutineStatus({ status, label }: { status: TaskStatus; label: string }) {
    const { theme } = useUnistyles();
    const colors: Record<TaskStatus, string> = {
        ok: "#2e7d32",
        warning: "#ed6c02"
    };
    return (
        <View style={routineStyles.container}>
            <Text style={[routineStyles.label, { color: theme.colors.onSurfaceVariant }]}>{label}</Text>
            <View style={[routineStyles.dot, { backgroundColor: colors[status] }]} />
        </View>
    );
}

const routineStyles = StyleSheet.create({
    container: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4
    },
    label: {
        fontSize: 13,
        fontFamily: "IBMPlexSans-Regular"
    }
});

const styles = StyleSheet.create({
    centered: {
        alignItems: "center",
        justifyContent: "center",
        padding: 32
    },
    errorText: {
        fontSize: 14,
        fontFamily: "IBMPlexSans-Regular",
        textAlign: "center"
    }
});

export function RoutinesView() {
    const { theme } = useUnistyles();

    const baseUrl = useAuthStore((s) => s.baseUrl);
    const token = useAuthStore((s) => s.token);

    const tasks = useTasksStore((s) => s.tasks);
    const loading = useTasksStore((s) => s.loading);
    const error = useTasksStore((s) => s.error);
    const fetchTasks = useTasksStore((s) => s.fetch);

    useEffect(() => {
        if (baseUrl && token) {
            void fetchTasks(baseUrl, token);
        }
    }, [baseUrl, token, fetchTasks]);

    // Recalculate "now" when tasks change so relative times are fresh
    // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally recompute when tasks update
    const now = useMemo(() => Date.now(), [tasks]);

    if (loading && tasks.length === 0) {
        return (
            <View style={[styles.centered, { flex: 1 }]}>
                <ActivityIndicator color={theme.colors.primary} />
            </View>
        );
    }

    if (error && tasks.length === 0) {
        return (
            <View style={[styles.centered, { flex: 1 }]}>
                <Text style={[styles.errorText, { color: theme.colors.error }]}>{error}</Text>
            </View>
        );
    }

    if (tasks.length === 0) {
        return (
            <View style={[styles.centered, { flex: 1 }]}>
                <Text style={[styles.errorText, { color: theme.colors.onSurfaceVariant }]}>No active routines</Text>
            </View>
        );
    }

    return (
        <ItemListStatic>
            <ItemGroup title="Active Routines">
                {tasks.map((task) => (
                    <Item
                        key={task.id}
                        title={task.title}
                        subtitle={tasksSubtitle(task)}
                        rightElement={
                            <RoutineStatus
                                status={tasksStatus(task)}
                                label={tasksFormatLastRun(task.lastExecutedAt, now)}
                            />
                        }
                        showChevron={false}
                    />
                ))}
            </ItemGroup>
        </ItemListStatic>
    );
}
