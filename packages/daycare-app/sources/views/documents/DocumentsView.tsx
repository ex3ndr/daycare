import * as React from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { useUnistyles } from "react-native-unistyles";
import { useAuthStore } from "@/modules/auth/authContext";
import { useDocumentsStore } from "@/modules/documents/documentsContext";

/**
 * Panel 2: Document editor with plain textarea for markdown editing.
 * Auto-saves after 1 second of inactivity.
 */
export const DocumentsView = React.memo(() => {
    const { theme } = useUnistyles();
    const baseUrl = useAuthStore((s) => s.baseUrl);
    const token = useAuthStore((s) => s.token);

    const selectedId = useDocumentsStore((s) => s.selectedId);
    const items = useDocumentsStore((s) => s.items);
    const draftBody = useDocumentsStore((s) => s.draftBody);
    const saving = useDocumentsStore((s) => s.saving);
    const setDraftBody = useDocumentsStore((s) => s.setDraftBody);
    const saveDraft = useDocumentsStore((s) => s.saveDraft);

    const selectedDoc = React.useMemo(() => items.find((d) => d.id === selectedId), [items, selectedId]);
    const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleBodyChange = React.useCallback(
        (text: string) => {
            setDraftBody(text);
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
            if (baseUrl && token) {
                saveTimerRef.current = setTimeout(() => {
                    void saveDraft(baseUrl, token);
                }, 1000);
            }
        },
        [setDraftBody, saveDraft, baseUrl, token]
    );

    // Cleanup timer on unmount
    React.useEffect(() => {
        return () => {
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        };
    }, []);

    if (!selectedDoc) {
        return (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 32 }}>
                <Text style={{ fontSize: 16, color: theme.colors.onSurfaceVariant }}>Select a document to edit</Text>
            </View>
        );
    }

    return (
        <View style={{ flex: 1 }}>
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
                <Text style={{ fontSize: 18, fontWeight: "600", color: theme.colors.onSurface }} numberOfLines={1}>
                    {selectedDoc.title}
                </Text>
                {saving && <Text style={{ fontSize: 12, color: theme.colors.onSurfaceVariant }}>Saving...</Text>}
            </View>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }}>
                <TextInput
                    value={draftBody ?? selectedDoc.body}
                    onChangeText={handleBodyChange}
                    multiline
                    textAlignVertical="top"
                    style={{
                        flex: 1,
                        padding: 20,
                        fontSize: 14,
                        lineHeight: 22,
                        color: theme.colors.onSurface,
                        fontFamily: "monospace"
                    }}
                    placeholderTextColor={theme.colors.onSurfaceVariant}
                    placeholder="Start writing..."
                />
            </ScrollView>
        </View>
    );
});
