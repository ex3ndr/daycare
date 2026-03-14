import { Octicons } from "@expo/vector-icons";
import * as React from "react";
import { Alert, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useUnistyles } from "react-native-unistyles";
import { useAuthStore } from "@/modules/auth/authContext";
import { vaultProtectedCheck } from "@/modules/documents/vaultProtectedCheck";
import { useVaultsStore } from "@/modules/documents/vaultsContext";
import { useWorkspace } from "@/modules/workspaces/workspaceProvider";

type VaultMetadataModalProps = {
    visible: boolean;
    onClose: () => void;
};

/**
 * Modal for viewing and editing vault entry metadata.
 * Protected vault entries (memory/system/people subtrees) are read-only.
 */
export const VaultMetadataModal = React.memo<VaultMetadataModalProps>(({ visible, onClose }) => {
    const { theme } = useUnistyles();
    const baseUrl = useAuthStore((s) => s.baseUrl);
    const token = useAuthStore((s) => s.token);
    const { workspaceId } = useWorkspace();

    const selectedId = useVaultsStore((s) => s.selectedId);
    const items = useVaultsStore((s) => s.items);
    const draftTitle = useVaultsStore((s) => s.draftTitle);
    const draftDescription = useVaultsStore((s) => s.draftDescription);
    const setDraftTitle = useVaultsStore((s) => s.setDraftTitle);
    const setDraftDescription = useVaultsStore((s) => s.setDraftDescription);
    const saveDraft = useVaultsStore((s) => s.saveDraft);
    const deleteDocument = useVaultsStore((s) => s.deleteDocument);

    const selectedDoc = React.useMemo(() => items.find((d) => d.id === selectedId), [items, selectedId]);
    const isProtected = React.useMemo(
        () => (selectedDoc ? vaultProtectedCheck(selectedDoc, items) : false),
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
            if (window.confirm("Are you sure you want to delete this vault entry?")) {
                void deleteDocument(baseUrl, token, workspaceId, selectedId);
                onClose();
            }
        } else {
            Alert.alert("Delete Vault Entry", "Are you sure you want to delete this vault entry?", [
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
                                        Delete Vault Entry
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
