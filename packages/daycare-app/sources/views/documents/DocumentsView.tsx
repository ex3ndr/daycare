import { Octicons } from "@expo/vector-icons";
import * as React from "react";
import { Pressable, Text, View } from "react-native";
import { useUnistyles } from "react-native-unistyles";
import { useDocumentsStore } from "@/modules/documents/documentsContext";
import { DocumentMarkdownView } from "./DocumentMarkdownView";
import { DocumentMetadataModal } from "./DocumentMetadataModal";
import { DocumentTreePanel } from "./DocumentTreePanel";

type DocumentsViewProps = {
    onCreatePress: (parentId?: string | null) => void;
};

/**
 * Document workspace with a left tree navigator and right markdown viewer.
 */
export const DocumentsView = React.memo<DocumentsViewProps>(({ onCreatePress }) => {
    const { theme } = useUnistyles();
    const selectedId = useDocumentsStore((s) => s.selectedId);
    const items = useDocumentsStore((s) => s.items);
    const [metadataVisible, setMetadataVisible] = React.useState(false);

    const selectedDoc = React.useMemo(() => items.find((d) => d.id === selectedId), [items, selectedId]);

    return (
        <View style={{ flex: 1, flexDirection: "row", overflow: "hidden" }}>
            <View
                style={{
                    width: 280,
                    borderRightWidth: 1,
                    borderRightColor: theme.colors.outlineVariant,
                    backgroundColor: theme.colors.surface
                }}
            >
                <DocumentTreePanel onCreatePress={onCreatePress} />
            </View>
            <View style={{ flex: 1, overflow: "hidden" }}>
                {selectedDoc ? (
                    <>
                        <View
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "space-between",
                                paddingHorizontal: 20,
                                paddingVertical: 14,
                                borderBottomWidth: 1,
                                borderBottomColor: theme.colors.outlineVariant
                            }}
                        >
                            <Text
                                style={{ flex: 1, fontSize: 18, fontWeight: "600", color: theme.colors.onSurface }}
                                numberOfLines={1}
                            >
                                {selectedDoc.title}
                            </Text>
                            <Pressable onPress={() => setMetadataVisible(true)} hitSlop={8} style={{ marginLeft: 12 }}>
                                <Octicons name="info" size={18} color={theme.colors.onSurfaceVariant} />
                            </Pressable>
                        </View>
                        <DocumentMarkdownView markdown={selectedDoc.body} />
                    </>
                ) : (
                    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 32 }}>
                        <Text style={{ fontSize: 16, color: theme.colors.onSurfaceVariant }}>
                            Select a document to view
                        </Text>
                    </View>
                )}
            </View>
            <DocumentMetadataModal visible={metadataVisible} onClose={() => setMetadataVisible(false)} />
        </View>
    );
});
