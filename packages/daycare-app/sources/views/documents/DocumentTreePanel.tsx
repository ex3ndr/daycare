import { Octicons } from "@expo/vector-icons";
import * as React from "react";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useUnistyles } from "react-native-unistyles";
import { useAuthStore } from "@/modules/auth/authContext";
import { useDocumentsStore } from "@/modules/documents/documentsContext";
import { documentTreeFlatten } from "@/modules/documents/documentTreeFlatten";
import { documentTreeNodeMoveValidate } from "@/modules/documents/documentTreeNodeMove";
import { DocumentTreeItem } from "./DocumentTreeItem";

type DocumentTreePanelProps = {
    onCreatePress: (parentId?: string | null) => void;
};

export const DocumentTreePanel = React.memo<DocumentTreePanelProps>(({ onCreatePress }) => {
    const { theme } = useUnistyles();
    const baseUrl = useAuthStore((s) => s.baseUrl);
    const token = useAuthStore((s) => s.token);

    const tree = useDocumentsStore((s) => s.tree);
    const items = useDocumentsStore((s) => s.items);
    const selectedId = useDocumentsStore((s) => s.selectedId);
    const expandedIds = useDocumentsStore((s) => s.expandedIds);
    const dragSourceId = useDocumentsStore((s) => s.dragSourceId);
    const dropTargetId = useDocumentsStore((s) => s.dropTargetId);
    const select = useDocumentsStore((s) => s.select);
    const toggle = useDocumentsStore((s) => s.toggle);
    const move = useDocumentsStore((s) => s.move);
    const setDragSource = useDocumentsStore((s) => s.setDragSource);
    const setDropTarget = useDocumentsStore((s) => s.setDropTarget);

    const flatEntries = React.useMemo(() => documentTreeFlatten(tree, expandedIds), [tree, expandedIds]);

    const handleDrop = React.useCallback(
        (targetId: string) => {
            if (!dragSourceId || dragSourceId === targetId || !baseUrl || !token) {
                setDragSource(null);
                setDropTarget(null);
                return;
            }
            if (!documentTreeNodeMoveValidate(items, dragSourceId, targetId)) {
                setDragSource(null);
                setDropTarget(null);
                return;
            }
            void move(baseUrl, token, dragSourceId, targetId);
            setDragSource(null);
            setDropTarget(null);
        },
        [dragSourceId, items, baseUrl, token, move, setDragSource, setDropTarget]
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
                          void move(baseUrl, token, dragSourceId, null);
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
                <Text style={{ fontSize: 13, fontWeight: "600", color: theme.colors.onSurfaceVariant }}>DOCUMENTS</Text>
                <Pressable onPress={() => onCreatePress(null)} hitSlop={8}>
                    <Octicons name="plus" size={18} color={theme.colors.onSurfaceVariant} />
                </Pressable>
            </View>
            <ScrollView style={{ flex: 1 }} {...(rootDropProps as Record<string, unknown>)}>
                {flatEntries.map((entry) => (
                    <DocumentTreeItem
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
                        No documents yet
                    </Text>
                )}
            </ScrollView>
        </View>
    );
});
