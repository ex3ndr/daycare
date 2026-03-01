import { Octicons } from "@expo/vector-icons";
import * as React from "react";
import { Alert, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useUnistyles } from "react-native-unistyles";
import { useAuthStore } from "@/modules/auth/authContext";
import { useDocumentsStore } from "@/modules/documents/documentsContext";

/**
 * Panel 3: Document metadata display and editing.
 * Shows title, description, slug, timestamps, and a delete button.
 */
export const DocumentMetadataPanel = React.memo(() => {
    const { theme } = useUnistyles();
    const baseUrl = useAuthStore((s) => s.baseUrl);
    const token = useAuthStore((s) => s.token);

    const selectedId = useDocumentsStore((s) => s.selectedId);
    const items = useDocumentsStore((s) => s.items);
    const draftTitle = useDocumentsStore((s) => s.draftTitle);
    const draftDescription = useDocumentsStore((s) => s.draftDescription);
    const setDraftTitle = useDocumentsStore((s) => s.setDraftTitle);
    const setDraftDescription = useDocumentsStore((s) => s.setDraftDescription);
    const saveDraft = useDocumentsStore((s) => s.saveDraft);
    const deleteDocument = useDocumentsStore((s) => s.deleteDocument);

    const selectedDoc = React.useMemo(() => items.find((d) => d.id === selectedId), [items, selectedId]);
    const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    const scheduleSave = React.useCallback(() => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        if (baseUrl && token) {
            saveTimerRef.current = setTimeout(() => {
                void saveDraft(baseUrl, token);
            }, 1000);
        }
    }, [saveDraft, baseUrl, token]);

    React.useEffect(() => {
        return () => {
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        };
    }, []);

    const handleDelete = React.useCallback(() => {
        if (!selectedId || !baseUrl || !token) return;
        if (Platform.OS === "web") {
            if (window.confirm("Are you sure you want to delete this document?")) {
                void deleteDocument(baseUrl, token, selectedId);
            }
        } else {
            Alert.alert("Delete Document", "Are you sure you want to delete this document?", [
                { text: "Cancel", style: "cancel" },
                { text: "Delete", style: "destructive", onPress: () => void deleteDocument(baseUrl, token, selectedId) }
            ]);
        }
    }, [selectedId, baseUrl, token, deleteDocument]);

    if (!selectedDoc) {
        return null;
    }

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
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
            <Text style={{ fontSize: 16, fontWeight: "600", color: theme.colors.onSurface, marginBottom: 20 }}>
                Metadata
            </Text>

            <Text style={labelStyle}>Title</Text>
            <TextInput
                value={draftTitle ?? selectedDoc.title}
                onChangeText={(text) => {
                    setDraftTitle(text);
                    scheduleSave();
                }}
                style={inputStyle}
            />

            <Text style={labelStyle}>Description</Text>
            <TextInput
                value={draftDescription ?? selectedDoc.description}
                onChangeText={(text) => {
                    setDraftDescription(text);
                    scheduleSave();
                }}
                multiline
                style={[inputStyle, { minHeight: 60 }]}
            />

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
                    <Text style={[valueStyle, { fontFamily: "monospace", fontSize: 12 }]}>{selectedDoc.parentId}</Text>
                </>
            )}

            <View
                style={{
                    marginTop: 16,
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
                    <Text style={{ fontSize: 14, color: theme.colors.onErrorContainer }}>Delete Document</Text>
                </Pressable>
            </View>
        </ScrollView>
    );
});
