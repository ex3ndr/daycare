import { Octicons } from "@expo/vector-icons";
import * as React from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { useUnistyles } from "react-native-unistyles";
import type { FlatTreeEntry } from "@/modules/documents/documentsTypes";

type DocumentTreeItemProps = {
    entry: FlatTreeEntry;
    selected: boolean;
    onPress: () => void;
    onToggle: () => void;
    onDragStart?: (id: string) => void;
    onDragOver?: (id: string) => void;
    onDrop?: (targetId: string) => void;
    onDragEnd?: () => void;
    dropHighlight?: boolean;
};

export const DocumentTreeItem = React.memo<DocumentTreeItemProps>((props) => {
    const { entry, selected, onPress, onToggle, onDragStart, onDragOver, onDrop, onDragEnd, dropHighlight } = props;
    const { theme } = useUnistyles();
    const indent = 12 + entry.depth * 20;

    const dragProps =
        Platform.OS === "web"
            ? {
                  draggable: true,
                  onDragStart: (e: { dataTransfer?: { setData: (t: string, v: string) => void } }) => {
                      e.dataTransfer?.setData("text/plain", entry.document.id);
                      onDragStart?.(entry.document.id);
                  },
                  onDragOver: (e: { preventDefault: () => void }) => {
                      e.preventDefault();
                      onDragOver?.(entry.document.id);
                  },
                  onDrop: (e: { preventDefault: () => void }) => {
                      e.preventDefault();
                      onDrop?.(entry.document.id);
                  },
                  onDragEnd: () => {
                      onDragEnd?.();
                  }
              }
            : {};

    return (
        <Pressable
            onPress={onPress}
            style={{
                flexDirection: "row",
                alignItems: "center",
                paddingLeft: indent,
                paddingRight: 12,
                paddingVertical: 8,
                backgroundColor: dropHighlight
                    ? theme.colors.primaryContainer
                    : selected
                      ? theme.colors.secondaryContainer
                      : "transparent"
            }}
            {...(dragProps as Record<string, unknown>)}
        >
            {entry.hasChildren ? (
                <Pressable onPress={onToggle} hitSlop={8} style={{ width: 24, alignItems: "center" }}>
                    <Octicons
                        name={entry.expanded ? "chevron-down" : "chevron-right"}
                        size={14}
                        color={theme.colors.onSurfaceVariant}
                    />
                </Pressable>
            ) : (
                <View style={{ width: 24 }} />
            )}
            <Octicons
                name="file"
                size={14}
                color={selected ? theme.colors.onSecondaryContainer : theme.colors.onSurfaceVariant}
                style={{ marginRight: 8 }}
            />
            <Text
                numberOfLines={1}
                style={{
                    flex: 1,
                    fontSize: 14,
                    color: selected ? theme.colors.onSecondaryContainer : theme.colors.onSurface
                }}
            >
                {entry.document.title}
            </Text>
        </Pressable>
    );
});
