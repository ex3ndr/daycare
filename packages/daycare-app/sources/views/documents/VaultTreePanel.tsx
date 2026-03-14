import { Octicons } from "@expo/vector-icons";
import * as React from "react";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useUnistyles } from "react-native-unistyles";
import { useAuthStore } from "@/modules/auth/authContext";
import { useVaultsStore } from "@/modules/documents/vaultsContext";
import { vaultTreeFlatten } from "@/modules/documents/vaultTreeFlatten";
import { vaultTreeNodeMoveValidate } from "@/modules/documents/vaultTreeNodeMove";
import { useWorkspace } from "@/modules/workspaces/workspaceProvider";
import { VaultTreeItem } from "./VaultTreeItem";

type VaultTreePanelProps = {
    onCreatePress: (parentId?: string | null) => void;
};

export const VaultTreePanel = React.memo<VaultTreePanelProps>(({ onCreatePress }) => {
    const { theme } = useUnistyles();
    const baseUrl = useAuthStore((s) => s.baseUrl);
    const token = useAuthStore((s) => s.token);
    const { workspaceId } = useWorkspace();

    const tree = useVaultsStore((s) => s.tree);
    const items = useVaultsStore((s) => s.items);
    const selectedId = useVaultsStore((s) => s.selectedId);
    const expandedIds = useVaultsStore((s) => s.expandedIds);
    const dragSourceId = useVaultsStore((s) => s.dragSourceId);
    const dropTargetId = useVaultsStore((s) => s.dropTargetId);
    const select = useVaultsStore((s) => s.select);
    const toggle = useVaultsStore((s) => s.toggle);
    const move = useVaultsStore((s) => s.move);
    const setDragSource = useVaultsStore((s) => s.setDragSource);
    const setDropTarget = useVaultsStore((s) => s.setDropTarget);

    const flatEntries = React.useMemo(() => vaultTreeFlatten(tree, expandedIds), [tree, expandedIds]);

    const handleDrop = React.useCallback(
        (targetId: string) => {
            if (!dragSourceId || dragSourceId === targetId || !baseUrl || !token) {
                setDragSource(null);
                setDropTarget(null);
                return;
            }
            if (!vaultTreeNodeMoveValidate(items, dragSourceId, targetId)) {
                setDragSource(null);
                setDropTarget(null);
                return;
            }
            void move(baseUrl, token, workspaceId, dragSourceId, targetId);
            setDragSource(null);
            setDropTarget(null);
        },
        [dragSourceId, items, baseUrl, token, workspaceId, move, setDragSource, setDropTarget]
    );

    // Allow dropping on root (the scroll area itself)
    const rootDropProps =
        Platform.OS === "web"
            ? {
                  onDragOver: (e: { preventDefault: () => void }) => {
                      e.preventDefault();
                      setDropTarget(null);
                  },
                  onDrop: (e: { preventDefault: () => void }) => {
                      e.preventDefault();
                      if (dragSourceId && baseUrl && token) {
                          void move(baseUrl, token, workspaceId, dragSourceId, null);
                      }
                      setDragSource(null);
                      setDropTarget(null);
                  }
              }
            : {};

    return (
        <View style={{ flex: 1 }}>
            <View
                style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingHorizontal: 16,
                    paddingVertical: 12
                }}
            >
                <Text style={{ fontSize: 13, fontWeight: "600", color: theme.colors.onSurfaceVariant }}>VAULT</Text>
                <Pressable onPress={() => onCreatePress(null)} hitSlop={8}>
                    <Octicons name="plus" size={18} color={theme.colors.onSurfaceVariant} />
                </Pressable>
            </View>
            <ScrollView style={{ flex: 1 }} {...(rootDropProps as Record<string, unknown>)}>
                {flatEntries.map((entry) => (
                    <VaultTreeItem
                        key={entry.document.id}
                        entry={entry}
                        selected={entry.document.id === selectedId}
                        onPress={() => select(entry.document.id)}
                        onToggle={() => toggle(entry.document.id)}
                        onDragStart={setDragSource}
                        onDragOver={setDropTarget}
                        onDrop={handleDrop}
                        onDragEnd={() => {
                            setDragSource(null);
                            setDropTarget(null);
                        }}
                        dropHighlight={dropTargetId === entry.document.id && dragSourceId !== entry.document.id}
                    />
                ))}
                {flatEntries.length === 0 && (
                    <Text
                        style={{
                            padding: 16,
                            fontSize: 14,
                            color: theme.colors.onSurfaceVariant,
                            textAlign: "center"
                        }}
                    >
                        No vault entries yet
                    </Text>
                )}
            </ScrollView>
        </View>
    );
});
