import { useEffect } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { Item } from "@/components/Item";
import { ItemGroup } from "@/components/ItemGroup";
import { ItemListStatic } from "@/components/ItemList";
import { useAuthStore } from "@/modules/auth/authContext";
import { useTasksStore } from "@/modules/tasks/tasksContext";
import { tasksSubtitle } from "@/modules/tasks/tasksSubtitle";
import type { TaskActiveSummary } from "@/modules/tasks/tasksTypes";

/** Formats a relative time label for task display. */
function taskTimeLabel(task: TaskActiveSummary): string {
    const now = Date.now();
    const age = now - task.updatedAt;
    const hours = Math.floor(age / 3_600_000);
    const days = Math.floor(age / 86_400_000);

    if (hours < 1) return "Just now";
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(task.updatedAt).toLocaleDateString();
}

export function TodosView() {
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
                <Text style={[styles.errorText, { color: theme.colors.onSurfaceVariant }]}>No active tasks</Text>
            </View>
        );
    }

    return (
        <ItemListStatic>
            <ItemGroup title="Active Tasks">
                {tasks.map((task) => (
                    <Item
                        key={task.id}
                        title={task.title}
                        subtitle={tasksSubtitle(task)}
                        detail={taskTimeLabel(task)}
                        showChevron={false}
                    />
                ))}
            </ItemGroup>
        </ItemListStatic>
    );
}

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
