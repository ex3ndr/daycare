import { Octicons } from "@expo/vector-icons";
import * as React from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import type { TodoTreeItem } from "@/modules/todos/todosFetch";

export type TodoDetailModalProps = {
    todo: TodoTreeItem | null;
    subtasks: TodoTreeItem[];
    onClose: () => void;
};

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
        case "finished":
            return theme.colors.primary;
        default:
            return theme.colors.onSurfaceVariant;
    }
}

/**
 * State-based modal that shows todo detail (status, description, subtasks).
 * Visible when todo prop is non-null.
 */
export const TodoDetailModal = React.memo<TodoDetailModalProps>(({ todo, subtasks, onClose }) => {
    const { theme } = useUnistyles();

    if (!todo) return null;

    const statusLabel = STATUS_LABELS[todo.status] ?? todo.status;

    return (
        <Modal visible transparent animationType="fade" onRequestClose={onClose}>
            <Pressable style={styles.backdrop} onPress={onClose}>
                <Pressable
                    style={[
                        styles.dialog,
                        {
                            backgroundColor: theme.colors.surface,
                            boxShadow: theme.elevation.level3
                        }
                    ]}
                    onPress={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={[styles.title, { color: theme.colors.onSurface }]} numberOfLines={2}>
                            {todo.title}
                        </Text>
                        <Pressable onPress={onClose} hitSlop={8} style={styles.closeButton}>
                            <Octicons name="x" size={20} color={theme.colors.onSurfaceVariant} />
                        </Pressable>
                    </View>

                    <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
                        {/* Status */}
                        <View style={styles.section}>
                            <Text style={[styles.label, { color: theme.colors.onSurfaceVariant }]}>Status</Text>
                            <View style={[styles.statusBadge, { backgroundColor: statusColor(todo.status, theme) }]}>
                                <Text style={[styles.statusText, { color: theme.colors.onPrimary }]}>
                                    {statusLabel}
                                </Text>
                            </View>
                        </View>

                        {/* Description */}
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

                        {/* Subtasks */}
                        {subtasks.length > 0 && (
                            <View style={styles.section}>
                                <Text style={[styles.label, { color: theme.colors.onSurfaceVariant }]}>Subtasks</Text>
                                {subtasks.map((child) => (
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

                        {/* Timestamps */}
                        <View style={styles.section}>
                            <Text style={[styles.label, { color: theme.colors.onSurfaceVariant }]}>Created</Text>
                            <Text style={[styles.meta, { color: theme.colors.onSurface }]}>
                                {new Date(todo.createdAt).toLocaleString()}
                            </Text>
                        </View>

                        <View style={styles.section}>
                            <Text style={[styles.label, { color: theme.colors.onSurfaceVariant }]}>Last updated</Text>
                            <Text style={[styles.meta, { color: theme.colors.onSurface }]}>
                                {new Date(todo.updatedAt).toLocaleString()}
                            </Text>
                        </View>
                    </ScrollView>
                </Pressable>
            </Pressable>
        </Modal>
    );
});

const styles = StyleSheet.create((_theme) => ({
    backdrop: {
        flex: 1,
        backgroundColor: "rgba(0, 0, 0, 0.4)",
        alignItems: "center",
        justifyContent: "center"
    },
    dialog: {
        width: "90%",
        maxWidth: 520,
        maxHeight: "80%",
        borderRadius: 16,
        overflow: "hidden"
    },
    header: {
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 4,
        gap: 12
    },
    title: {
        flex: 1,
        fontSize: 18,
        fontFamily: "IBMPlexSans-SemiBold",
        lineHeight: 24
    },
    closeButton: {
        width: 32,
        height: 32,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 16
    },
    body: {
        flex: 1
    },
    bodyContent: {
        padding: 20,
        gap: 20
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
