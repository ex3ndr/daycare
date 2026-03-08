import * as React from "react";
import { Platform, Text, View } from "react-native";
import { useUnistyles } from "react-native-unistyles";
import { PageHeader } from "@/components/PageHeader";
import { ReorderingList } from "@/components/ReorderingList";
import { ReorderingList2 } from "@/components/ReorderingList2";
import { useAuthStore } from "@/modules/auth/authContext";
import { type TodoTreeItem, todosFetch } from "@/modules/todos/todosFetch";
import { useWorkspace } from "@/modules/workspaces/workspaceProvider";
import { TodoCardView } from "@/views/todos/TodoCardView";

const POLL_INTERVAL = 5000;
const ITEM_HEIGHT = Platform.OS === "web" ? 44 : 52;
const ITEM_GAP = Platform.OS === "web" ? 4 : 6;

type FlatTodoEntry = {
    item: TodoTreeItem;
    depth: number;
};

/**
 * Computes depth for each todo in a preordered flat tree.
 * Expects: items are in depth-first preorder from the /todos/tree endpoint.
 */
function todosComputeDepths(items: TodoTreeItem[]): FlatTodoEntry[] {
    const depthMap = new Map<string, number>();
    const result: FlatTodoEntry[] = [];

    for (const item of items) {
        const depth = item.parentId ? (depthMap.get(item.parentId) ?? 0) + 1 : 0;
        depthMap.set(item.id, depth);
        result.push({ item, depth });
    }

    return result;
}

/**
 * Todos screen with server-backed data, polling every 5 seconds.
 * Read-only view with animated reordering when data changes.
 */
export function TodosView() {
    const { theme } = useUnistyles();
    const baseUrl = useAuthStore((s) => s.baseUrl);
    const token = useAuthStore((s) => s.token);
    const { workspaceId } = useWorkspace();

    const [entries, setEntries] = React.useState<FlatTodoEntry[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    const fetchTodos = React.useCallback(async () => {
        if (!baseUrl || !token) return;
        try {
            const todos = await todosFetch(baseUrl, token, workspaceId);
            setEntries(todosComputeDepths(todos));
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to fetch todos");
        } finally {
            setLoading(false);
        }
    }, [baseUrl, token, workspaceId]);

    // Initial fetch + polling
    React.useEffect(() => {
        void fetchTodos();
        const interval = setInterval(() => void fetchTodos(), POLL_INTERVAL);
        return () => clearInterval(interval);
    }, [fetchTodos]);

    const renderItem = React.useCallback(
        (entry: FlatTodoEntry) => <TodoCardView item={entry.item} depth={entry.depth} />,
        []
    );

    const keyExtractor = React.useCallback((entry: FlatTodoEntry) => entry.item.id, []);

    const header = <View style={{ paddingTop: 12 }} />;

    const ReorderComponent = Platform.OS === "web" ? ReorderingList : ReorderingList2;

    return (
        <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
            <PageHeader title="Todos" icon="checklist" />
            <View style={{ flex: 1, maxWidth: theme.layout.maxWidth, width: "100%", alignSelf: "center" }}>
                {loading && entries.length === 0 ? (
                    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                        <Text style={{ color: theme.colors.onSurfaceVariant, fontFamily: "IBMPlexSans-Regular" }}>
                            Loading...
                        </Text>
                    </View>
                ) : error && entries.length === 0 ? (
                    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                        <Text style={{ color: theme.colors.error, fontFamily: "IBMPlexSans-Regular" }}>{error}</Text>
                    </View>
                ) : entries.length === 0 ? (
                    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                        <Text style={{ color: theme.colors.onSurfaceVariant, fontFamily: "IBMPlexSans-Regular" }}>
                            No todos yet
                        </Text>
                    </View>
                ) : (
                    <View style={{ flexGrow: 1, flexBasis: 0 }}>
                        <ReorderComponent
                            items={entries}
                            renderItem={renderItem}
                            keyExtractor={keyExtractor}
                            itemHeight={ITEM_HEIGHT}
                            gap={ITEM_GAP}
                            header={header}
                        />
                    </View>
                )}
            </View>
        </View>
    );
}
