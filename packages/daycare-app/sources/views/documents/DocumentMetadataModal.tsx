import { Octicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import * as React from "react";
import { Alert, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useUnistyles } from "react-native-unistyles";
import { useAuthStore } from "@/modules/auth/authContext";
import { documentProtectedCheck } from "@/modules/documents/documentProtectedCheck";
import { useDocumentsStore } from "@/modules/documents/documentsContext";
import { documentWorkspaceIdResolve } from "@/modules/documents/documentWorkspaceIdResolve";
import { useWorkspacesStore } from "@/modules/workspaces/workspacesContext";

type DocumentMetadataModalProps = {
    visible: boolean;
    onClose: () => void;
};

/**
 * Modal for viewing and editing document metadata.
 * Protected documents (memory/system/people subtrees) are read-only.
 */
export const DocumentMetadataModal = React.memo<DocumentMetadataModalProps>(({ visible, onClose }) => {
    const { theme } = useUnistyles();
    const { workspace } = useLocalSearchParams<{ workspace?: string | string[] }>();
    const baseUrl = useAuthStore((s) => s.baseUrl);
    const token = useAuthStore((s) => s.token);
    const activeId = useWorkspacesStore((s) => s.activeId);
    const workspaceId = React.useMemo(() => documentWorkspaceIdResolve(workspace, activeId), [workspace, activeId]);

    const selectedId = useDocumentsStore((s) => s.selectedId);
    const items = useDocumentsStore((s) => s.items);
    const draftTitle = useDocumentsStore((s) => s.draftTitle);
    const draftDescription = useDocumentsStore((s) => s.draftDescription);
    const setDraftTitle = useDocumentsStore((s) => s.setDraftTitle);
    const setDraftDescription = useDocumentsStore((s) => s.setDraftDescription);
    const saveDraft = useDocumentsStore((s) => s.saveDraft);
    const deleteDocument = useDocumentsStore((s) => s.deleteDocument);

    const selectedDoc = React.useMemo(() => items.find((d) => d.id === selectedId), [items, selectedId]);
    const isProtected = React.useMemo(
        () => (selectedDoc ? documentProtectedCheck(selectedDoc, items) : false),
        [selectedDoc, items]
    );
    const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    const scheduleSave = React.useCallback(() => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        if (baseUrl && token) {
            saveTimerRef.current = setTimeout(() => {
                void saveDraft(baseUrl, token, workspaceId);
            }, 1000);
        }
    }, [saveDraft, baseUrl, token, workspaceId]);

    React.useEffect(() => {
        return () => {
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        };
    }, []);

    const handleDelete = React.useCallback(() => {
        if (!selectedId || !baseUrl || !token) return;
        if (Platform.OS === "web") {
            if (window.confirm("Are you sure you want to delete this document?")) {
                void deleteDocument(baseUrl, token, workspaceId, selectedId);
                onClose();
            }
        } else {
            Alert.alert("Delete Document", "Are you sure you want to delete this document?", [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: () => {
                        void deleteDocument(baseUrl, token, workspaceId, selectedId);
                        onClose();
                    }
                }
            ]);
        }
    }, [selectedId, baseUrl, token, workspaceId, deleteDocument, onClose]);

    if (!selectedDoc) return null;

    const labelStyle = {
        fontSize: 12,
        fontWeight: "600" as const,
        color: theme.colors.onSurfaceVariant,
        marginBottom: 4,
        textTransform: "uppercase" as const
    };

    const inputStyle = {
        fontSize: 14,
        color: theme.colors.onSurface,
        borderWidth: 1,
        borderColor: theme.colors.outlineVariant,
        borderRadius: 8,
        padding: 10,
        marginBottom: 16
    };

    const valueStyle = {
        fontSize: 14,
        color: theme.colors.onSurface,
        marginBottom: 16
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View
                style={{
                    flex: 1,
                    justifyContent: "center",
                    alignItems: "center",
                    backgroundColor: Platform.OS === "web" ? "rgba(0,0,0,0.4)" : undefined
                }}
            >
                <Pressable style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} onPress={onClose} />
                <View
                    style={{
                        width: 420,
                        maxWidth: "90%",
                        maxHeight: "80%",
                        backgroundColor: theme.colors.surface,
                        borderRadius: 16,
                        boxShadow: theme.elevation.level3
                    }}
                >
                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            paddingHorizontal: 24,
                            paddingTop: 20,
                            paddingBottom: 12
                        }}
                    >
                        <Text style={{ fontSize: 18, fontWeight: "600", color: theme.colors.onSurface }}>Metadata</Text>
                        <Pressable onPress={onClose} hitSlop={8}>
                            <Octicons name="x" size={18} color={theme.colors.onSurfaceVariant} />
                        </Pressable>
                    </View>

                    <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}>
                        <Text style={labelStyle}>Title</Text>
                        {isProtected ? (
                            <Text style={valueStyle}>{selectedDoc.title}</Text>
                        ) : (
                            <TextInput
                                value={draftTitle ?? selectedDoc.title}
                                onChangeText={(text) => {
                                    setDraftTitle(text);
                                    scheduleSave();
                                }}
                                style={inputStyle}
                            />
                        )}

                        <Text style={labelStyle}>Description</Text>
                        {isProtected ? (
                            <Text style={valueStyle}>{selectedDoc.description || "—"}</Text>
                        ) : (
                            <TextInput
                                value={draftDescription ?? selectedDoc.description}
                                onChangeText={(text) => {
                                    setDraftDescription(text);
                                    scheduleSave();
                                }}
                                multiline
                                style={[inputStyle, { minHeight: 60 }]}
                            />
                        )}

                        <Text style={labelStyle}>Slug</Text>
                        <Text style={valueStyle}>{selectedDoc.slug}</Text>

                        <Text style={labelStyle}>ID</Text>
                        <Text style={[valueStyle, { fontFamily: "monospace", fontSize: 12 }]}>{selectedDoc.id}</Text>

                        <Text style={labelStyle}>Created</Text>
                        <Text style={valueStyle}>{new Date(selectedDoc.createdAt).toLocaleString()}</Text>

                        <Text style={labelStyle}>Updated</Text>
                        <Text style={valueStyle}>{new Date(selectedDoc.updatedAt).toLocaleString()}</Text>

                        {selectedDoc.parentId && (
                            <>
                                <Text style={labelStyle}>Parent ID</Text>
                                <Text style={[valueStyle, { fontFamily: "monospace", fontSize: 12 }]}>
                                    {selectedDoc.parentId}
                                </Text>
                            </>
                        )}

                        {!isProtected && (
                            <View
                                style={{
                                    marginTop: 8,
                                    borderTopWidth: 1,
                                    borderTopColor: theme.colors.outlineVariant,
                                    paddingTop: 16
                                }}
                            >
                                <Pressable
                                    onPress={handleDelete}
                                    style={{
                                        flexDirection: "row",
                                        alignItems: "center",
                                        gap: 8,
                                        paddingVertical: 10,
                                        paddingHorizontal: 12,
                                        borderRadius: 8,
                                        backgroundColor: theme.colors.errorContainer
                                    }}
                                >
                                    <Octicons name="trash" size={14} color={theme.colors.onErrorContainer} />
                                    <Text style={{ fontSize: 14, color: theme.colors.onErrorContainer }}>
                                        Delete Document
                                    </Text>
                                </Pressable>
                            </View>
                        )}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
});
