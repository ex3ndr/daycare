import { Octicons } from "@expo/vector-icons";
import { createId } from "@paralleldrive/cuid2";
import { usePathname, useRouter } from "expo-router";
import * as React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { type AppMode, appModes } from "@/components/AppHeader";
import { Avatar } from "@/components/Avatar";
import { useAuthStore } from "@/modules/auth/authContext";
import { useDocumentsStore } from "@/modules/documents/documentsContext";
import { DocumentCreateDialog } from "@/views/documents/DocumentCreateDialog";

export const SIDEBAR_WIDTH = 240;

const segments: Array<{ mode: AppMode; icon: React.ComponentProps<typeof Octicons>["name"]; label: string }> = [
    { mode: "home", icon: "home", label: "Home" },
    { mode: "todos", icon: "checklist", label: "Todos" },
    { mode: "people", icon: "people", label: "People" },
    { mode: "documents", icon: "file", label: "Documents" },
    { mode: "email", icon: "mail", label: "Email" },
    { mode: "inbox", icon: "inbox", label: "Inbox" },
    { mode: "agents", icon: "device-desktop", label: "Agents" },
    { mode: "routines", icon: "clock", label: "Routines" },
    { mode: "costs", icon: "credit-card", label: "Costs" },
    { mode: "settings", icon: "gear", label: "Settings" }
];

/** Sub-items for each mode that expand when the mode is active. */
const modeItems: Record<AppMode, Array<{ id: string; title: string }>> = {
    home: [],
    agents: [],
    people: [],
    email: [],
    inbox: [],
    todos: [],
    routines: [],
    costs: [],
    documents: [],
    settings: []
};

/**
 * Extracts the current AppMode from the pathname.
 * E.g. "/agents" -> "agents", "/agents/a1" -> "agents".
 */
function extractModeFromPath(pathname: string): AppMode {
    const segment = pathname.split("/").filter(Boolean)[0];
    if (segment && appModes.includes(segment as AppMode)) {
        return segment as AppMode;
    }
    return "home";
}

/**
 * Extracts the selected item id from the pathname.
 * E.g. "/agents/a1" -> "a1", "/agents" -> undefined.
 */
function extractItemFromPath(pathname: string): string | undefined {
    const parts = pathname.split("/").filter(Boolean);
    return parts.length >= 2 ? parts[1] : undefined;
}

type AppSidebarProps = {
    /** Called after any navigation action (e.g. to close a drawer). */
    onNavigate?: () => void;
};

/**
 * Tree-style sidebar navigation.
 * Shows all modes as expandable tree nodes with sub-items.
 * Parent controls sizing and safe area margins.
 */
export const AppSidebar = React.memo<AppSidebarProps>(({ onNavigate }) => {
    const { theme } = useUnistyles();
    const pathname = usePathname();
    const router = useRouter();

    const activeMode = extractModeFromPath(pathname);
    const selectedItem = extractItemFromPath(pathname);

    // Documents store
    const baseUrl = useAuthStore((s) => s.baseUrl);
    const token = useAuthStore((s) => s.token);
    const documents = useDocumentsStore((s) => s.items);
    const fetchDocuments = useDocumentsStore((s) => s.fetch);
    const createDocument = useDocumentsStore((s) => s.createDocument);
    const documentsSelected = useDocumentsStore((s) => s.selectedId);
    const selectDocument = useDocumentsStore((s) => s.select);

    const [createDialogVisible, setCreateDialogVisible] = React.useState(false);

    // Fetch documents when the documents mode is active
    React.useEffect(() => {
        if (activeMode === "documents" && baseUrl && token) {
            void fetchDocuments(baseUrl, token);
        }
    }, [activeMode, baseUrl, token, fetchDocuments]);

    // Documents under ~/document (children of the root "document" folder)
    const sidebarDocs = React.useMemo(() => {
        const docRoot = documents.find((d) => d.slug === "document" && d.parentId === null);
        if (!docRoot) return [];
        return documents.filter((d) => d.parentId === docRoot.id).sort((a, b) => a.title.localeCompare(b.title));
    }, [documents]);

    const handleModePress = React.useCallback(
        (mode: AppMode) => {
            router.replace(`/${mode}` as `/${string}`);
            onNavigate?.();
        },
        [router, onNavigate]
    );

    const handleItemPress = React.useCallback(
        (mode: AppMode, itemId: string) => {
            router.replace(`/${mode}/${itemId}` as `/${string}`);
            onNavigate?.();
        },
        [router, onNavigate]
    );

    const handleDocumentPress = React.useCallback(
        (docId: string) => {
            selectDocument(docId);
            router.replace("/documents" as `/${string}`);
            onNavigate?.();
        },
        [selectDocument, router, onNavigate]
    );

    const handleCreateDocument = React.useCallback(
        (input: { title: string; slug: string; parentId: string | null }) => {
            if (!baseUrl || !token) return;
            void createDocument(baseUrl, token, { id: createId(), ...input });
        },
        [baseUrl, token, createDocument]
    );

    return (
        <View style={[styles.sidebar, { backgroundColor: theme.colors.surface }]}>
            {/* Logo header */}
            <View style={styles.header}>
                <Octicons name="hubot" size={20} color={theme.colors.onSurface} />
                <Text style={[styles.title, { color: theme.colors.onSurface }]}>Daycare</Text>
            </View>

            {/* Tree navigation */}
            <ScrollView style={styles.treeContainer} showsVerticalScrollIndicator={false}>
                {segments.map((seg) => {
                    const isActive = activeMode === seg.mode;
                    const isDocuments = seg.mode === "documents";
                    const items = modeItems[seg.mode];
                    const hasStaticItems = items.length > 0;
                    const hasItems = hasStaticItems || (isDocuments && isActive);

                    return (
                        <View key={seg.mode}>
                            <Pressable
                                testID={`sidebar-${seg.mode}`}
                                onPress={() => handleModePress(seg.mode)}
                                style={[styles.modeRow, isActive && { backgroundColor: theme.colors.primaryContainer }]}
                            >
                                <Octicons
                                    name={seg.icon}
                                    size={16}
                                    color={isActive ? theme.colors.onPrimaryContainer : theme.colors.onSurfaceVariant}
                                />
                                <Text
                                    style={[
                                        styles.modeLabel,
                                        {
                                            color: isActive
                                                ? theme.colors.onPrimaryContainer
                                                : theme.colors.onSurfaceVariant
                                        },
                                        isActive && styles.modeLabelActive
                                    ]}
                                >
                                    {seg.label}
                                </Text>
                                {hasItems && (
                                    <Octicons
                                        name={isActive ? "chevron-down" : "chevron-right"}
                                        size={12}
                                        color={
                                            isActive ? theme.colors.onPrimaryContainer : theme.colors.onSurfaceVariant
                                        }
                                    />
                                )}
                            </Pressable>

                            {/* Documents sub-items (dynamic from store) */}
                            {isDocuments && isActive && (
                                <View style={styles.subItems}>
                                    {sidebarDocs.map((doc) => {
                                        const isSelected = documentsSelected === doc.id;
                                        return (
                                            <Pressable
                                                key={doc.id}
                                                testID={`sidebar-doc-${doc.id}`}
                                                onPress={() => handleDocumentPress(doc.id)}
                                                style={[
                                                    styles.subItemRow,
                                                    isSelected && {
                                                        backgroundColor: theme.colors.surfaceContainerHigh
                                                    }
                                                ]}
                                            >
                                                <Text
                                                    style={[
                                                        styles.subItemLabel,
                                                        {
                                                            color: isSelected
                                                                ? theme.colors.onSurface
                                                                : theme.colors.onSurfaceVariant
                                                        }
                                                    ]}
                                                    numberOfLines={1}
                                                >
                                                    {doc.title}
                                                </Text>
                                            </Pressable>
                                        );
                                    })}
                                    <Pressable
                                        testID="sidebar-doc-create"
                                        onPress={() => setCreateDialogVisible(true)}
                                        style={styles.subItemRow}
                                    >
                                        <Octicons
                                            name="plus"
                                            size={14}
                                            color={theme.colors.onSurfaceVariant}
                                            style={styles.createIcon}
                                        />
                                        <Text style={[styles.subItemLabel, { color: theme.colors.onSurfaceVariant }]}>
                                            New Document
                                        </Text>
                                    </Pressable>
                                </View>
                            )}

                            {/* Static sub-items for other modes */}
                            {!isDocuments && isActive && hasStaticItems && (
                                <View style={styles.subItems}>
                                    {items.map((item) => {
                                        const isSelected = selectedItem === item.id;
                                        return (
                                            <Pressable
                                                key={item.id}
                                                testID={`sidebar-item-${item.id}`}
                                                onPress={() => handleItemPress(seg.mode, item.id)}
                                                style={[
                                                    styles.subItemRow,
                                                    isSelected && {
                                                        backgroundColor: theme.colors.surfaceContainerHigh
                                                    }
                                                ]}
                                            >
                                                <Text
                                                    style={[
                                                        styles.subItemLabel,
                                                        {
                                                            color: isSelected
                                                                ? theme.colors.onSurface
                                                                : theme.colors.onSurfaceVariant
                                                        }
                                                    ]}
                                                >
                                                    {item.title}
                                                </Text>
                                            </Pressable>
                                        );
                                    })}
                                </View>
                            )}
                        </View>
                    );
                })}
            </ScrollView>

            {/* Footer with avatar */}
            <View style={[styles.footer, { borderTopColor: theme.colors.outlineVariant }]}>
                <Avatar id="daycare-user" size={32} />
            </View>

            {/* Document create dialog */}
            <DocumentCreateDialog
                visible={createDialogVisible}
                parentId={null}
                onClose={() => setCreateDialogVisible(false)}
                onCreate={handleCreateDocument}
            />
        </View>
    );
});

const styles = StyleSheet.create({
    sidebar: {
        flex: 1
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingHorizontal: 20,
        height: 56
    },
    title: {
        fontSize: 18,
        fontWeight: "600"
    },
    treeContainer: {
        flex: 1,
        paddingHorizontal: 8
    },
    modeRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingHorizontal: 12,
        height: 36,
        borderRadius: 8,
        marginVertical: 1
    },
    modeLabel: {
        fontSize: 14,
        fontWeight: "400",
        flex: 1
    },
    modeLabelActive: {
        fontWeight: "600"
    },
    subItems: {
        paddingLeft: 16,
        marginBottom: 4
    },
    subItemRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 12,
        paddingLeft: 22,
        height: 32,
        borderRadius: 6,
        marginVertical: 1
    },
    subItemLabel: {
        fontSize: 13,
        fontWeight: "400"
    },
    createIcon: {
        marginRight: 6
    },
    footer: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderTopWidth: StyleSheet.hairlineWidth,
        alignItems: "flex-start"
    }
});
