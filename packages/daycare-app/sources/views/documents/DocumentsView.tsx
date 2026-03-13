import { Octicons } from "@expo/vector-icons";
import * as React from "react";
import { Pressable, Text, View } from "react-native";
import { useUnistyles } from "react-native-unistyles";
import { useAuthStore } from "@/modules/auth/authContext";
import { documentProtectedCheck } from "@/modules/documents/documentProtectedCheck";
import { useDocumentsStore } from "@/modules/documents/documentsContext";
import { useWorkspace } from "@/modules/workspaces/workspaceProvider";
import { DocumentEditorView } from "./DocumentEditorView";
import { DocumentHistoryPanel } from "./DocumentHistoryPanel";
import { DocumentMarkdownView } from "./DocumentMarkdownView";
import { DocumentMetadataModal } from "./DocumentMetadataModal";
import { DocumentTreePanel } from "./DocumentTreePanel";

type DocumentsViewProps = {
    onCreatePress: (parentId?: string | null) => void;
};

type ViewTab = "view" | "edit" | "history";

/**
 * Vault workspace with a left tree navigator and right content panel.
 * Supports three tabs: view (rendered markdown), edit (WYSIWYG), and history (version diffs).
 */
export const DocumentsView = React.memo<DocumentsViewProps>(({ onCreatePress }) => {
    const { theme } = useUnistyles();
    const baseUrl = useAuthStore((s) => s.baseUrl);
    const token = useAuthStore((s) => s.token);
    const { workspaceId } = useWorkspace();

    const selectedId = useDocumentsStore((s) => s.selectedId);
    const items = useDocumentsStore((s) => s.items);
    const setDraftBody = useDocumentsStore((s) => s.setDraftBody);
    const saveDraft = useDocumentsStore((s) => s.saveDraft);
    const saving = useDocumentsStore((s) => s.saving);
    const history = useDocumentsStore((s) => s.history);
    const historyLoading = useDocumentsStore((s) => s.historyLoading);
    const fetchHistory = useDocumentsStore((s) => s.fetchHistory);

    const [metadataVisible, setMetadataVisible] = React.useState(false);
    const [activeTab, setActiveTab] = React.useState<ViewTab>("view");
    const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    const selectedDoc = React.useMemo(() => items.find((d) => d.id === selectedId), [items, selectedId]);
    const isProtected = React.useMemo(
        () => (selectedDoc ? documentProtectedCheck(selectedDoc, items) : false),
        [selectedDoc, items]
    );

    // Reset tab when selection changes
    React.useEffect(() => {
        setActiveTab("view");
    }, []);

    // Fetch history when history tab is activated
    React.useEffect(() => {
        if (activeTab === "history" && selectedId && baseUrl && token) {
            void fetchHistory(baseUrl, token, workspaceId, selectedId);
        }
    }, [activeTab, selectedId, baseUrl, token, workspaceId, fetchHistory]);

    // Clean up save timer
    React.useEffect(() => {
        return () => {
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        };
    }, []);

    const handleEditorChange = React.useCallback(
        (markdown: string) => {
            setDraftBody(markdown);
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
            if (baseUrl && token) {
                saveTimerRef.current = setTimeout(() => {
                    void saveDraft(baseUrl, token, workspaceId);
                }, 1500);
            }
        },
        [setDraftBody, saveDraft, baseUrl, token, workspaceId]
    );

    const tabStyle = (tab: ViewTab) => ({
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 4,
        backgroundColor: activeTab === tab ? `${theme.colors.primary}18` : ("transparent" as string)
    });

    const tabTextStyle = (tab: ViewTab) => ({
        fontSize: 13,
        fontWeight: "500" as const,
        color: activeTab === tab ? theme.colors.primary : theme.colors.onSurfaceVariant
    });

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
                        {/* Header with title + tabs */}
                        <View
                            style={{
                                borderBottomWidth: 1,
                                borderBottomColor: theme.colors.outlineVariant
                            }}
                        >
                            <View
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    paddingHorizontal: 20,
                                    paddingTop: 14,
                                    paddingBottom: 8
                                }}
                            >
                                <Text
                                    style={{
                                        flex: 1,
                                        fontSize: 18,
                                        fontWeight: "600",
                                        color: theme.colors.onSurface
                                    }}
                                    numberOfLines={1}
                                >
                                    {selectedDoc.title}
                                </Text>
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                                    {saving && (
                                        <Text style={{ fontSize: 12, color: theme.colors.onSurfaceVariant }}>
                                            Saving...
                                        </Text>
                                    )}
                                    <Pressable onPress={() => setMetadataVisible(true)} hitSlop={8}>
                                        <Octicons name="info" size={18} color={theme.colors.onSurfaceVariant} />
                                    </Pressable>
                                </View>
                            </View>

                            {/* Tab bar */}
                            <View
                                style={{
                                    flexDirection: "row",
                                    paddingHorizontal: 16,
                                    paddingBottom: 8,
                                    gap: 4
                                }}
                            >
                                <Pressable onPress={() => setActiveTab("view")} style={tabStyle("view")}>
                                    <Text style={tabTextStyle("view")}>View</Text>
                                </Pressable>
                                {!isProtected && (
                                    <Pressable onPress={() => setActiveTab("edit")} style={tabStyle("edit")}>
                                        <Text style={tabTextStyle("edit")}>Edit</Text>
                                    </Pressable>
                                )}
                                <Pressable onPress={() => setActiveTab("history")} style={tabStyle("history")}>
                                    <Text style={tabTextStyle("history")}>History</Text>
                                </Pressable>
                            </View>
                        </View>

                        {/* Content */}
                        {activeTab === "view" && <DocumentMarkdownView markdown={selectedDoc.body} />}
                        {activeTab === "edit" && !isProtected && (
                            <DocumentEditorView markdown={selectedDoc.body} onChange={handleEditorChange} />
                        )}
                        {activeTab === "history" && (
                            <DocumentHistoryPanel versions={history} loading={historyLoading} />
                        )}
                    </>
                ) : (
                    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 32 }}>
                        <Text style={{ fontSize: 16, color: theme.colors.onSurfaceVariant }}>
                            Select a vault entry to view
                        </Text>
                    </View>
                )}
            </View>
            <DocumentMetadataModal visible={metadataVisible} onClose={() => setMetadataVisible(false)} />
        </View>
    );
});
