import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { Item } from "@/components/Item";
import { ItemGroup } from "@/components/ItemGroup";
import { ItemList } from "@/components/ItemList";
import { PageHeader } from "@/components/PageHeader";
import { useAuthStore } from "@/modules/auth/authContext";
import { useTasksStore } from "@/modules/tasks/tasksContext";
import { tasksFormatLastRun } from "@/modules/tasks/tasksFormatLastRun";
import { tasksFormatNextRunRelative } from "@/modules/tasks/tasksFormatNextRunRelative";
import { tasksNextRunAtFind } from "@/modules/tasks/tasksNextRunAtFind";
import { tasksSortByNextRun } from "@/modules/tasks/tasksSortByNextRun";
import { tasksStatus } from "@/modules/tasks/tasksStatus";
import { tasksSubtitle } from "@/modules/tasks/tasksSubtitle";
import type { CronTriggerSummary, TaskStatus, WebhookTriggerSummary } from "@/modules/tasks/tasksTypes";
import { useTasksNow } from "@/modules/tasks/useTasksNow";
import { useWorkspace } from "@/modules/workspaces/workspaceProvider";

function AutomationStatus({ status, label }: { status: TaskStatus; label: string }) {
    const { theme } = useUnistyles();
    const colors: Record<TaskStatus, string> = {
        ok: "#2e7d32",
        warning: "#ed6c02"
    };
    return (
        <View style={automationStyles.container}>
            <Text style={[automationStyles.label, { color: theme.colors.onSurfaceVariant }]}>{label}</Text>
            <View style={[automationStyles.dot, { backgroundColor: colors[status] }]} />
        </View>
    );
}

const automationStyles = StyleSheet.create({
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

export function AutomationsView() {
    const { theme } = useUnistyles();
    const router = useRouter();

    const baseUrl = useAuthStore((s) => s.baseUrl);
    const token = useAuthStore((s) => s.token);
    const { workspaceId } = useWorkspace();

    const tasks = useTasksStore((s) => s.tasks);
    const triggers = useTasksStore((s) => s.triggers);
    const loading = useTasksStore((s) => s.loading);
    const error = useTasksStore((s) => s.error);
    const fetchTasks = useTasksStore((s) => s.fetch);

    useEffect(() => {
        if (baseUrl && token) {
            void fetchTasks(baseUrl, token, workspaceId);
        }
    }, [baseUrl, token, workspaceId, fetchTasks]);

    // Index triggers by taskId for efficient lookup
    const triggersByTask = useMemo(() => {
        const cronByTask = new Map<string, CronTriggerSummary[]>();
        const webhookByTask = new Map<string, WebhookTriggerSummary[]>();
        for (const cron of triggers.cron) {
            const existing = cronByTask.get(cron.taskId);
            if (existing) {
                existing.push(cron);
            } else {
                cronByTask.set(cron.taskId, [cron]);
            }
        }
        for (const webhook of triggers.webhook) {
            const existing = webhookByTask.get(webhook.taskId);
            if (existing) {
                existing.push(webhook);
            } else {
                webhookByTask.set(webhook.taskId, [webhook]);
            }
        }
        return { cronByTask, webhookByTask };
    }, [triggers]);

    const taskCron = useCallback((taskId: string) => triggersByTask.cronByTask.get(taskId) ?? [], [triggersByTask]);
    const taskWebhook = useCallback(
        (taskId: string) => triggersByTask.webhookByTask.get(taskId) ?? [],
        [triggersByTask]
    );

    const handleTaskPress = useCallback(
        (taskId: string) => {
            router.push(`/${workspaceId}/automation/${taskId}`);
        },
        [router, workspaceId]
    );

    const now = useTasksNow(triggers.cron);
    const sortedTasks = useMemo(
        () => tasksSortByNextRun(tasks, triggersByTask.cronByTask, now),
        [tasks, triggersByTask, now]
    );

    if (loading && tasks.length === 0) {
        return (
            <View style={{ flex: 1 }}>
                <PageHeader title="Automations" icon="clock" />
                <View style={[styles.centered, { flex: 1 }]}>
                    <ActivityIndicator color={theme.colors.primary} />
                </View>
            </View>
        );
    }

    if (error && tasks.length === 0) {
        return (
            <View style={{ flex: 1 }}>
                <PageHeader title="Automations" icon="clock" />
                <View style={[styles.centered, { flex: 1 }]}>
                    <Text style={[styles.errorText, { color: theme.colors.error }]}>{error}</Text>
                </View>
            </View>
        );
    }

    if (tasks.length === 0) {
        return (
            <View style={{ flex: 1 }}>
                <PageHeader title="Automations" icon="clock" />
                <View style={[styles.centered, { flex: 1 }]}>
                    <Text style={[styles.errorText, { color: theme.colors.onSurfaceVariant }]}>No automations</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={{ flex: 1 }}>
            <PageHeader title="Automations" icon="clock" />
            <ItemList>
                <ItemGroup title="Automations">
                    {sortedTasks.map((task) => (
                        <Item
                            key={task.id}
                            title={task.title}
                            subtitle={taskSubtitleBuild(taskCron(task.id), taskWebhook(task.id), now)}
                            subtitleLines={0}
                            onPress={() => handleTaskPress(task.id)}
                            rightElement={
                                <AutomationStatus
                                    status={tasksStatus(task)}
                                    label={tasksFormatLastRun(task.lastExecutedAt, now)}
                                />
                            }
                        />
                    ))}
                </ItemGroup>
            </ItemList>
        </View>
    );
}

function taskSubtitleBuild(cron: CronTriggerSummary[], webhook: WebhookTriggerSummary[], now: number): string {
    const summary = tasksSubtitle(cron, webhook);
    if (cron.length === 0) {
        return summary;
    }

    return `${summary}\nNext fire: ${tasksFormatNextRunRelative(tasksNextRunAtFind(cron, now), now)}`;
}
