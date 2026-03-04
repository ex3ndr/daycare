import * as React from "react";
import { Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { PageHeader } from "@/components/PageHeader";
import { TodoList } from "@/views/todos/TodoList";
import type { TodoItem } from "@/views/todos/todoTypes";

const INITIAL_TODOS: TodoItem[] = [
    {
        id: "hdr-daycare",
        title: "# Daycare",
        done: false,
        favorite: false
    },
    {
        id: "todo-setup",
        title: "Audit current onboarding flow",
        done: false,
        favorite: true,
        notes: "Collect baseline screenshots for web and mobile.",
        due: { date: "2026-03-03" },
        hint: "Capture key states",
        subtasks: [
            { id: "sub-1", text: "Entry screen", rank: "a", done: true },
            { id: "sub-2", text: "Profile screen", rank: "b", done: false }
        ]
    },
    {
        id: "todo-copy",
        title: "Prepare launch copy",
        done: false,
        favorite: false,
        hint: "Keep it concise"
    },
    {
        id: "hdr-product",
        title: "# Product",
        done: false,
        favorite: false
    },
    {
        id: "todo-release",
        title: "Review release checklist",
        done: true,
        favorite: false,
        due: { date: "2026-03-01" },
        magic: true,
        magicProcessed: false
    },
    {
        id: "todo-dnd",
        title: "Test drag-and-drop interactions",
        done: false,
        favorite: true,
        notes: "Validate long-press reorder on touch devices."
    }
];

/**
 * Todos screen with local-only state so the list UI works without backend wiring.
 * Includes task editing, toggles, and drag-and-drop reordering in the center panel.
 */
export function TodosView() {
    const { theme } = useUnistyles();
    const [todos, setTodos] = React.useState<TodoItem[]>(INITIAL_TODOS);
    const [selectedId, setSelectedId] = React.useState<string | null>(null);

    const handleToggleTodo = React.useCallback((id: string, done: boolean) => {
        setTodos((prev) => prev.map((todo) => (todo.id === id ? { ...todo, done } : todo)));
    }, []);

    const handleToggleFavorite = React.useCallback((id: string, favorite: boolean) => {
        setTodos((prev) => prev.map((todo) => (todo.id === id ? { ...todo, favorite } : todo)));
    }, []);

    const handleUpdateTodo = React.useCallback((id: string, title: string) => {
        setTodos((prev) => prev.map((todo) => (todo.id === id ? { ...todo, title } : todo)));
    }, []);

    const handleReorderTodo = React.useCallback((id: string, newIndex: number) => {
        setTodos((prev) => {
            const fromIndex = prev.findIndex((todo) => todo.id === id);
            if (fromIndex === -1 || fromIndex === newIndex) {
                return prev;
            }

            const clampedIndex = Math.max(0, Math.min(prev.length - 1, newIndex));
            const next = [...prev];
            const [item] = next.splice(fromIndex, 1);
            next.splice(clampedIndex, 0, item);
            return next;
        });
    }, []);

    const selectedTodo = React.useMemo(() => {
        return selectedId ? todos.find((todo) => todo.id === selectedId) || null : null;
    }, [selectedId, todos]);

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
            <PageHeader title="Todo List UI" subtitle="No backend wiring" icon="checklist" />
            <View style={styles.inner}>
                <TodoList
                    todos={todos}
                    onToggleTodo={handleToggleTodo}
                    onToggleFavorite={handleToggleFavorite}
                    onUpdateTodo={handleUpdateTodo}
                    onReorderTodo={handleReorderTodo}
                    onTaskPress={setSelectedId}
                    editable={true}
                    footer={
                        selectedTodo ? (
                            <View
                                style={[
                                    styles.selection,
                                    {
                                        backgroundColor: theme.colors.surfaceContainer,
                                        borderColor: theme.colors.outlineVariant
                                    }
                                ]}
                            >
                                <Text style={[styles.selectionTitle, { color: theme.colors.onSurface }]}>
                                    Selected task
                                </Text>
                                <Text style={[styles.selectionValue, { color: theme.colors.onSurfaceVariant }]}>
                                    {selectedTodo.title}
                                </Text>
                            </View>
                        ) : (
                            <View
                                style={[
                                    styles.selection,
                                    {
                                        backgroundColor: theme.colors.surfaceContainer,
                                        borderColor: theme.colors.outlineVariant
                                    }
                                ]}
                            >
                                <Text style={[styles.selectionValue, { color: theme.colors.onSurfaceVariant }]}>
                                    Select a task
                                </Text>
                            </View>
                        )
                    }
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create((theme) => ({
    container: {
        flex: 1
    },
    inner: {
        flex: 1,
        maxWidth: theme.layout.maxWidth,
        width: "100%",
        alignSelf: "center"
    },
    selection: {
        marginHorizontal: 16,
        borderRadius: 12,
        borderWidth: 1,
        paddingHorizontal: 12,
        paddingVertical: 10
    },
    selectionTitle: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 12,
        marginBottom: 4
    },
    selectionValue: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13
    }
}));
