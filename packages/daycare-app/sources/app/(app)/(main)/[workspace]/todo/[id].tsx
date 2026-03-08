import { useLocalSearchParams } from "expo-router";
import * as React from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { ItemList } from "@/components/ItemList";
import { PageHeader } from "@/components/PageHeader";
import { useAuthStore } from "@/modules/auth/authContext";
import { type TodoTreeItem, todosFetch } from "@/modules/todos/todosFetch";
import { useWorkspace } from "@/modules/workspaces/workspaceProvider";

export default function TodoDetailScreen() {
    const { theme } = useUnistyles();
    const { id } = useLocalSearchParams<{ id: string }>();
    const baseUrl = useAuthStore((s) => s.baseUrl);
    const token = useAuthStore((s) => s.token);
    const { workspaceId } = useWorkspace();

    const [todo, setTodo] = React.useState<TodoTreeItem | null>(null);
    const [children, setChildren] = React.useState<TodoTreeItem[]>([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        if (!baseUrl || !token || !id) return;

        void (async () => {
            try {
                const todos = await todosFetch(baseUrl, token, workspaceId);
                const found = todos.find((t) => t.id === id) ?? null;
                setTodo(found);
                if (found) {
                    setChildren(todos.filter((t) => t.parentId === found.id));
                }
            } finally {
                setLoading(false);
            }
        })();
    }, [baseUrl, token, workspaceId, id]);

    const statusLabel = todo ? (STATUS_LABELS[todo.status] ?? todo.status) : "";

    return (
        <View style={[styles.root, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.inner}>
                <PageHeader title={todo?.title ?? "Todo"} icon="checklist" />
                {loading ? (
                    <View style={[styles.centered, { flex: 1 }]}>
                        <ActivityIndicator color={theme.colors.primary} />
                    </View>
                ) : !todo ? (
                    <View style={[styles.centered, { flex: 1 }]}>
                        <Text style={{ color: theme.colors.onSurfaceVariant, fontFamily: "IBMPlexSans-Regular" }}>
                            Todo not found
                        </Text>
                    </View>
                ) : (
                    <ItemList>
                        <View style={styles.content}>
                            <View style={styles.section}>
                                <Text style={[styles.label, { color: theme.colors.onSurfaceVariant }]}>Status</Text>
                                <View
                                    style={[styles.statusBadge, { backgroundColor: statusColor(todo.status, theme) }]}
                                >
                                    <Text style={[styles.statusText, { color: theme.colors.onPrimary }]}>
                                        {statusLabel}
                                    </Text>
                                </View>
                            </View>

                            {todo.description.trim().length > 0 && (
                                <View style={styles.section}>
                                    <Text style={[styles.label, { color: theme.colors.onSurfaceVariant }]}>
                                        Description
                                    </Text>
                                    <Text style={[styles.description, { color: theme.colors.onSurface }]}>
                                        {todo.description}
                                    </Text>
                                </View>
                            )}

                            {children.length > 0 && (
                                <View style={styles.section}>
                                    <Text style={[styles.label, { color: theme.colors.onSurfaceVariant }]}>
                                        Subtasks
                                    </Text>
                                    {children.map((child) => (
                                        <View key={child.id} style={styles.subtaskRow}>
                                            <View
                                                style={[
                                                    styles.subtaskDot,
                                                    {
                                                        backgroundColor:
                                                            child.status === "finished"
                                                                ? theme.colors.primary
                                                                : theme.colors.onSurfaceVariant
                                                    }
                                                ]}
                                            />
                                            <Text
                                                style={[
                                                    styles.subtaskText,
                                                    {
                                                        color:
                                                            child.status === "finished"
                                                                ? theme.colors.onSurfaceVariant
                                                                : theme.colors.onSurface,
                                                        textDecorationLine:
                                                            child.status === "finished" ? "line-through" : "none",
                                                        opacity: child.status === "finished" ? 0.6 : 1
                                                    }
                                                ]}
                                            >
                                                {child.title}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            )}

                            <View style={styles.section}>
                                <Text style={[styles.label, { color: theme.colors.onSurfaceVariant }]}>Created</Text>
                                <Text style={[styles.meta, { color: theme.colors.onSurface }]}>
                                    {new Date(todo.createdAt).toLocaleString()}
                                </Text>
                            </View>

                            <View style={styles.section}>
                                <Text style={[styles.label, { color: theme.colors.onSurfaceVariant }]}>
                                    Last updated
                                </Text>
                                <Text style={[styles.meta, { color: theme.colors.onSurface }]}>
                                    {new Date(todo.updatedAt).toLocaleString()}
                                </Text>
                            </View>
                        </View>
                    </ItemList>
                )}
            </View>
        </View>
    );
}

const STATUS_LABELS: Record<string, string> = {
    draft: "Draft",
    unstarted: "Not Started",
    started: "In Progress",
    finished: "Done",
    abandoned: "Abandoned"
};

function statusColor(status: string, theme: ReturnType<typeof useUnistyles>["theme"]): string {
    switch (status) {
        case "started":
            return theme.colors.primary;
        case "finished":
            return theme.colors.primary;
        case "abandoned":
            return theme.colors.onSurfaceVariant;
        default:
            return theme.colors.onSurfaceVariant;
    }
}

const styles = StyleSheet.create((theme) => ({
    root: {
        flex: 1,
        alignItems: "center"
    },
    inner: {
        flex: 1,
        width: "100%",
        maxWidth: theme.layout.maxWidth
    },
    centered: {
        alignItems: "center",
        justifyContent: "center"
    },
    content: {
        padding: 20,
        gap: 24
    },
    section: {
        gap: 6
    },
    label: {
        fontSize: 12,
        fontFamily: "IBMPlexSans-SemiBold",
        textTransform: "uppercase",
        letterSpacing: 0.5
    },
    statusBadge: {
        alignSelf: "flex-start",
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6
    },
    statusText: {
        fontSize: 13,
        fontFamily: "IBMPlexSans-SemiBold"
    },
    description: {
        fontSize: 15,
        fontFamily: "IBMPlexSans-Regular",
        lineHeight: 22
    },
    subtaskRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingVertical: 4
    },
    subtaskDot: {
        width: 6,
        height: 6,
        borderRadius: 3
    },
    subtaskText: {
        fontSize: 14,
        fontFamily: "IBMPlexSans-Regular",
        flex: 1
    },
    meta: {
        fontSize: 14,
        fontFamily: "IBMPlexSans-Regular"
    }
}));
