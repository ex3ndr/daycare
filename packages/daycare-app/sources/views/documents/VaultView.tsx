import { Octicons } from "@expo/vector-icons";
import * as React from "react";
import { Pressable, Text, View } from "react-native";
import { useUnistyles } from "react-native-unistyles";
import { useAuthStore } from "@/modules/auth/authContext";
import { vaultProtectedCheck } from "@/modules/documents/vaultProtectedCheck";
import { useVaultsStore } from "@/modules/documents/vaultsContext";
import { useWorkspace } from "@/modules/workspaces/workspaceProvider";
import { VaultEditorView } from "./VaultEditorView";
import { VaultHistoryPanel } from "./VaultHistoryPanel";
import { VaultMarkdownView } from "./VaultMarkdownView";
import { VaultMetadataModal } from "./VaultMetadataModal";
import { VaultTreePanel } from "./VaultTreePanel";

type VaultViewProps = {
    onCreatePress: (parentId?: string | null) => void;
};

type ViewTab = "view" | "edit" | "history";

/**
 * Vault workspace with a left tree navigator and right content panel.
 * Supports three tabs: view (rendered markdown), edit (WYSIWYG), and history (version diffs).
 */
export const VaultView = React.memo<VaultViewProps>(({ onCreatePress }) => {
    const { theme } = useUnistyles();
    const baseUrl = useAuthStore((s) => s.baseUrl);
    const token = useAuthStore((s) => s.token);
    const { workspaceId } = useWorkspace();

    const selectedId = useVaultsStore((s) => s.selectedId);
    const items = useVaultsStore((s) => s.items);
    const setDraftBody = useVaultsStore((s) => s.setDraftBody);
    const saveDraft = useVaultsStore((s) => s.saveDraft);
    const saving = useVaultsStore((s) => s.saving);
    const history = useVaultsStore((s) => s.history);
    const historyLoading = useVaultsStore((s) => s.historyLoading);
    const fetchHistory = useVaultsStore((s) => s.fetchHistory);

    const [metadataVisible, setMetadataVisible] = React.useState(false);
    const [activeTab, setActiveTab] = React.useState<ViewTab>("view");
    const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    const selectedDoc = React.useMemo(() => items.find((d) => d.id === selectedId), [items, selectedId]);
    const isProtected = React.useMemo(
        () => (selectedDoc ? vaultProtectedCheck(selectedDoc, items) : false),
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
                <VaultTreePanel onCreatePress={onCreatePress} />
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
                        {activeTab === "view" && <VaultMarkdownView markdown={selectedDoc.body} />}
                        {activeTab === "edit" && !isProtected && (
                            <VaultEditorView markdown={selectedDoc.body} onChange={handleEditorChange} />
                        )}
                        {activeTab === "history" && <VaultHistoryPanel versions={history} loading={historyLoading} />}
                    </>
                ) : (
                    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 32 }}>
                        <Text style={{ fontSize: 16, color: theme.colors.onSurfaceVariant }}>
                            Select a vault entry to view
                        </Text>
                    </View>
                )}
            </View>
            <VaultMetadataModal visible={metadataVisible} onClose={() => setMetadataVisible(false)} />
        </View>
    );
});
