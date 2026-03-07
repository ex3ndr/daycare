import { Octicons } from "@expo/vector-icons";
import { createId } from "@paralleldrive/cuid2";
import { usePathname, useRouter } from "expo-router";
import * as React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import Animated, { type SharedValue, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { useAuthStore } from "@/modules/auth/authContext";
import { documentRootIdResolve } from "@/modules/documents/documentRootIdResolve";
import { useDocumentsStore } from "@/modules/documents/documentsContext";
import { type AppMode, appModes } from "@/modules/navigation/appModes";
import { useWorkspacesStore } from "@/modules/workspaces/workspacesContext";
import type { WorkspaceListItem } from "@/modules/workspaces/workspacesFetch";
import { DocumentCreateDialog } from "@/views/documents/DocumentCreateDialog";

export const SIDEBAR_WIDTH = 240;
export const SIDEBAR_COLLAPSED_WIDTH = 56;

type Segment = { mode: AppMode; icon: React.ComponentProps<typeof Octicons>["name"]; label: string };

/** Sidebar items grouped with visual spacing between groups. */
const segmentGroups: Segment[][] = [
    [{ mode: "home", icon: "home", label: "Home" }],
    [
        { mode: "todos", icon: "checklist", label: "Todos" },
        { mode: "documents", icon: "file", label: "Documents" }
    ],
    [
        { mode: "agents", icon: "device-desktop", label: "Agents" },
        { mode: "fragments", icon: "note", label: "Fragments" },
        { mode: "routines", icon: "clock", label: "Routines" },
        { mode: "files", icon: "file-directory", label: "Files" },
        { mode: "skills", icon: "zap", label: "Skills" },
        { mode: "tools", icon: "tools", label: "Tools" },
        { mode: "costs", icon: "credit-card", label: "Costs" }
    ]
];

/** Bottom-pinned items shown as icons in the workspace strip. */
const stripBottomSegments: Segment[] = [
    { mode: "dev", icon: "code-square", label: "Dev" },
    { mode: "settings", icon: "gear", label: "Settings" }
];

/** Sub-items for each mode that expand when the mode is active. */
const modeItems: Record<AppMode, Array<{ id: string; title: string }>> = {
    home: [],
    agents: [],
    fragments: [],
    todos: [],
    routines: [],
    costs: [],
    documents: [],
    files: [],
    skills: [],
    tools: [],
    dev: [
        { id: "components", title: "Components" },
        { id: "examples", title: "Examples" },
        { id: "showcase", title: "Showcase" },
        { id: "lottie", title: "Lottie" },
        { id: "monty", title: "Monty" }
    ],
    settings: []
};

/**
 * Extracts the workspace id from the pathname.
 * E.g. "/{workspaceId}/agents" -> workspaceId, "/home" -> undefined.
 */
function extractWorkspaceFromPath(pathname: string): string | undefined {
    const parts = pathname.split("/").filter(Boolean);
    // If there are at least 2 segments and the 2nd is an app mode, the 1st is the workspace
    if (parts.length >= 2 && appModes.includes(parts[1] as AppMode)) {
        return parts[0];
    }
    return parts[0] && !appModes.includes(parts[0] as AppMode) ? parts[0] : undefined;
}

/**
 * Extracts the current AppMode from the pathname.
 * Handles both /{workspace}/{mode} and /{mode} paths.
 * E.g. "/steve/agents" -> "agents", "/steve/agents/a1" -> "agents".
 */
function extractModeFromPath(pathname: string): AppMode {
    const parts = pathname.split("/").filter(Boolean);
    // Try 2nd segment first (workspace-prefixed path)
    if (parts.length >= 2 && appModes.includes(parts[1] as AppMode)) {
        return parts[1] as AppMode;
    }
    // Fallback to 1st segment (for bare paths)
    if (parts[0] && appModes.includes(parts[0] as AppMode)) {
        return parts[0] as AppMode;
    }
    return "home";
}

/**
 * Extracts the selected item id from the pathname.
 * E.g. "/steve/agents/a1" -> "a1", "/steve/agents" -> undefined.
 */
function extractItemFromPath(pathname: string): string | undefined {
    const parts = pathname.split("/").filter(Boolean);
    // Workspace-prefixed: /{workspace}/{mode}/{item}
    if (parts.length >= 3 && appModes.includes(parts[1] as AppMode)) {
        return parts[2];
    }
    // Bare: /{mode}/{item}
    if (parts.length >= 2 && appModes.includes(parts[0] as AppMode)) {
        return parts[1];
    }
    return undefined;
}

function workspaceInitials(ws: WorkspaceListItem): string {
    if (ws.firstName && ws.lastName) {
        return `${ws.firstName[0]}${ws.lastName[0]}`.toUpperCase();
    }
    if (ws.firstName) {
        return ws.firstName.slice(0, 2).toUpperCase();
    }
    return ws.nametag.slice(0, 2).toUpperCase();
}

const WorkspaceButton = React.memo<{
    workspace: WorkspaceListItem;
    isActive: boolean;
    onPress: () => void;
}>(({ workspace, isActive, onPress }) => {
    const { theme } = useUnistyles();
    const label = workspace.emoji ?? workspaceInitials(workspace);
    return (
        <Pressable
            onPress={onPress}
            style={[
                stripStyles.workspaceButton,
                {
                    backgroundColor: isActive ? theme.colors.primaryContainer : theme.colors.surfaceContainerHigh
                }
            ]}
        >
            <Text
                style={[
                    workspace.emoji ? stripStyles.workspaceEmoji : stripStyles.workspaceInitials,
                    !workspace.emoji && {
                        color: isActive ? theme.colors.onPrimaryContainer : theme.colors.onSurfaceVariant
                    }
                ]}
            >
                {label}
            </Text>
        </Pressable>
    );
});

export const WORKSPACE_STRIP_WIDTH = 52;

/**
 * Vertical workspace strip with workspace buttons and bottom action icons.
 * Rendered outside the sidebar card on the page background.
 */
export const WorkspaceStrip = React.memo<{ onNavigate?: () => void; style?: any }>(({ onNavigate, style }) => {
    const { theme } = useUnistyles();
    const router = useRouter();
    const pathname = usePathname();
    const workspaces = useWorkspacesStore((s) => s.workspaces);
    const activeId = useWorkspacesStore((s) => s.activeId);
    const activeMode = extractModeFromPath(pathname);
    const workspace = extractWorkspaceFromPath(pathname);
    const wsPrefix = workspace ? `/${workspace}` : "";

    const handleWorkspaceSwitch = React.useCallback(
        (userId: string) => {
            router.replace(`/${userId}/home` as any);
            onNavigate?.();
        },
        [router, onNavigate]
    );

    const handleModePress = React.useCallback(
        (mode: AppMode) => {
            router.replace(`${wsPrefix}/${mode}` as any);
            onNavigate?.();
        },
        [router, onNavigate, wsPrefix]
    );

    return (
        <View style={[stripStyles.strip, style]}>
            <View style={stripStyles.stripTop}>
                {workspaces
                    .filter((ws) => ws.isSelf)
                    .map((ws) => (
                        <WorkspaceButton
                            key={ws.userId}
                            workspace={ws}
                            isActive={ws.userId === activeId}
                            onPress={() => handleWorkspaceSwitch(ws.userId)}
                        />
                    ))}
                {workspaces.some((ws) => !ws.isSelf) && (
                    <View style={[stripStyles.divider, { backgroundColor: theme.colors.outlineVariant }]} />
                )}
                {workspaces
                    .filter((ws) => !ws.isSelf)
                    .map((ws) => (
                        <WorkspaceButton
                            key={ws.userId}
                            workspace={ws}
                            isActive={ws.userId === activeId}
                            onPress={() => handleWorkspaceSwitch(ws.userId)}
                        />
                    ))}
            </View>
            <View style={stripStyles.stripBottom}>
                {stripBottomSegments.map((seg) => {
                    const isActive = activeMode === seg.mode;
                    return (
                        <Pressable
                            key={seg.mode}
                            testID={`sidebar-${seg.mode}`}
                            onPress={() => handleModePress(seg.mode)}
                            style={[
                                stripStyles.workspaceButton,
                                isActive && { backgroundColor: theme.colors.primaryContainer }
                            ]}
                        >
                            <Octicons
                                name={seg.icon}
                                size={16}
                                color={isActive ? theme.colors.onPrimaryContainer : theme.colors.onSurfaceVariant}
                            />
                        </Pressable>
                    );
                })}
            </View>
        </View>
    );
});

const stripStyles = StyleSheet.create({
    strip: {
        width: WORKSPACE_STRIP_WIDTH,
        paddingTop: 8,
        paddingBottom: 8,
        alignItems: "center",
        justifyContent: "space-between"
    },
    stripTop: {
        alignItems: "center",
        gap: 4
    },
    stripBottom: {
        alignItems: "center",
        gap: 4
    },
    divider: {
        width: 24,
        height: 1,
        borderRadius: 1,
        marginVertical: 2
    },
    workspaceButton: {
        width: 36,
        height: 36,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center"
    },
    workspaceInitials: {
        fontSize: 13,
        fontWeight: "600"
    },
    workspaceEmoji: {
        fontSize: 18
    }
});

type AppSidebarProps = {
    /** Called after any navigation action (e.g. to close a drawer). */
    onNavigate?: () => void;
    /** Called when the user toggles the collapsed state. */
    onToggleCollapse?: () => void;
    /** Animated opacity for labels/text (fades out when collapsing). */
    labelsOpacity?: SharedValue<number>;
    /** Animated sidebar width (used to size active row backgrounds). */
    sidebarWidth?: SharedValue<number>;
    /** Whether the sidebar is currently collapsed. */
    collapsed?: boolean;
};

/**
 * Tree-style sidebar navigation.
 * Always renders at full SIDEBAR_WIDTH; parent clips via overflow: hidden + animated width.
 */
export const AppSidebar = React.memo<AppSidebarProps>(
    ({ onNavigate, onToggleCollapse, labelsOpacity, sidebarWidth, collapsed }) => {
        const { theme } = useUnistyles();

        const labelsAnimatedStyle = useAnimatedStyle(() => ({
            opacity: labelsOpacity ? labelsOpacity.value : 1
        }));
        // Active row background width: sidebar width minus treeContainer horizontal padding (8*2)
        const activeRowBgStyle = useAnimatedStyle(() => ({
            width: sidebarWidth ? sidebarWidth.value - 16 : SIDEBAR_WIDTH - 16
        }));
        // Collapse button: right-aligned, animates position with sidebar width
        const headerHovered = useSharedValue(0);
        const collapseButtonStyle = useAnimatedStyle(() => {
            const labels = labelsOpacity ? labelsOpacity.value : 1;
            const sw = sidebarWidth ? sidebarWidth.value : SIDEBAR_WIDTH;
            return {
                left: sw - 40,
                opacity: Math.max(labels, headerHovered.value)
            };
        });
        const expandedIconStyle = useAnimatedStyle(() => ({
            opacity: labelsOpacity ? labelsOpacity.value : 1
        }));
        const collapsedIconStyle = useAnimatedStyle(() => ({
            opacity: labelsOpacity ? 1 - labelsOpacity.value : 0
        }));

        const pathname = usePathname();
        const router = useRouter();

        const workspace = extractWorkspaceFromPath(pathname);
        const activeMode = extractModeFromPath(pathname);
        const selectedItem = extractItemFromPath(pathname);

        const activeId = useWorkspacesStore((s) => s.activeId);
        const workspaces = useWorkspacesStore((s) => s.workspaces);
        const activeWorkspace = workspaces.find((ws) => ws.userId === activeId);

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
                void fetchDocuments(baseUrl, token, activeId);
            }
        }, [activeMode, baseUrl, token, activeId, fetchDocuments]);

        // Root documents are shown directly in the sidebar so system, memory, and people are visible.
        const documentRootId = React.useMemo(() => documentRootIdResolve(documents), [documents]);

        const sidebarDocs = React.useMemo(() => {
            return documents.filter((d) => d.parentId === null).sort((a, b) => a.title.localeCompare(b.title));
        }, [documents]);

        const wsPrefix = workspace ? `/${workspace}` : "";

        const handleModePress = React.useCallback(
            (mode: AppMode) => {
                router.replace(`${wsPrefix}/${mode}` as any);
                onNavigate?.();
            },
            [router, onNavigate, wsPrefix]
        );

        const handleItemPress = React.useCallback(
            (mode: AppMode, itemId: string) => {
                router.replace(`${wsPrefix}/${mode}/${itemId}` as any);
                onNavigate?.();
            },
            [router, onNavigate, wsPrefix]
        );

        const handleDocumentPress = React.useCallback(
            (docId: string) => {
                selectDocument(docId);
                router.replace(`${wsPrefix}/documents` as any);
                onNavigate?.();
            },
            [selectDocument, router, onNavigate, wsPrefix]
        );

        const handleCreateDocument = React.useCallback(
            (input: { title: string; slug: string; parentId: string | null }) => {
                if (!baseUrl || !token) return;
                const parentId = input.parentId ?? documentRootId;
                if (!parentId) return;
                void createDocument(baseUrl, token, activeId, {
                    id: createId(),
                    title: input.title,
                    slug: input.slug,
                    parentId
                });
            },
            [baseUrl, token, activeId, createDocument, documentRootId]
        );

        return (
            <View style={[styles.sidebar, { backgroundColor: theme.colors.surface }]}>
                {/* Workspace header — entire row is pressable to toggle collapse */}
                <Pressable
                    onPress={onToggleCollapse}
                    style={styles.header}
                    onHoverIn={() => (headerHovered.value = withTiming(1, { duration: 150 }))}
                    onHoverOut={() => (headerHovered.value = withTiming(0, { duration: 150 }))}
                >
                    <Text style={styles.headerEmoji}>
                        {activeWorkspace?.isSelf ? "\uD83D\uDD12" : (activeWorkspace?.emoji ?? "\uD83D\uDCE6")}
                    </Text>
                    <Animated.View style={[styles.headerLabels, labelsAnimatedStyle]}>
                        <Text style={[styles.title, { color: theme.colors.onSurface }]} numberOfLines={1}>
                            {activeWorkspace?.isSelf ? "Personal" : (activeWorkspace?.firstName ?? "Workspace")}
                        </Text>
                    </Animated.View>
                    <Animated.View
                        style={[styles.collapseButton, { backgroundColor: theme.colors.surface }, collapseButtonStyle]}
                        pointerEvents="none"
                    >
                        <Animated.View style={[styles.collapseIcon, expandedIconStyle]}>
                            <Octicons name="sidebar-expand" size={16} color={theme.colors.onSurfaceVariant} />
                        </Animated.View>
                        <Animated.View style={[styles.collapseIcon, collapsedIconStyle]}>
                            <Octicons name="sidebar-collapse" size={16} color={theme.colors.onSurfaceVariant} />
                        </Animated.View>
                    </Animated.View>
                </Pressable>

                {/* Tree navigation */}
                <ScrollView style={styles.treeContainer} showsVerticalScrollIndicator={false}>
                    {segmentGroups.map((group, groupIndex) => (
                        <View
                            key={group.map((s) => s.mode).join("-")}
                            style={groupIndex > 0 ? styles.groupSpacer : undefined}
                        >
                            {group.map((seg) => {
                                const isActive = activeMode === seg.mode;
                                const isDocumentsMode = seg.mode === "documents";
                                const items = modeItems[seg.mode];
                                const hasStaticItems = items.length > 0;
                                const hasItems = hasStaticItems || (isDocumentsMode && isActive);

                                return (
                                    <View key={seg.mode}>
                                        <Pressable
                                            testID={`sidebar-${seg.mode}`}
                                            onPress={() => handleModePress(seg.mode)}
                                            style={styles.modeRow}
                                        >
                                            {isActive && (
                                                <Animated.View
                                                    style={[
                                                        styles.activeRowBg,
                                                        { backgroundColor: theme.colors.primaryContainer },
                                                        activeRowBgStyle
                                                    ]}
                                                />
                                            )}
                                            <Octicons
                                                name={seg.icon}
                                                size={16}
                                                color={
                                                    isActive
                                                        ? theme.colors.onPrimaryContainer
                                                        : theme.colors.onSurfaceVariant
                                                }
                                            />
                                            <Animated.View style={[styles.modeLabelRow, labelsAnimatedStyle]}>
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
                                                            isActive
                                                                ? theme.colors.onPrimaryContainer
                                                                : theme.colors.onSurfaceVariant
                                                        }
                                                    />
                                                )}
                                            </Animated.View>
                                        </Pressable>

                                        {/* Documents sub-items (dynamic from store) */}
                                        {!collapsed && isDocumentsMode && isActive && (
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
                                                    <Text
                                                        style={[
                                                            styles.subItemLabel,
                                                            { color: theme.colors.onSurfaceVariant }
                                                        ]}
                                                    >
                                                        New Document
                                                    </Text>
                                                </Pressable>
                                            </View>
                                        )}

                                        {/* Static sub-items for other modes */}
                                        {!collapsed && !isDocumentsMode && isActive && hasStaticItems && (
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
                        </View>
                    ))}
                </ScrollView>

                {/* Document create dialog */}
                <DocumentCreateDialog
                    visible={createDialogVisible}
                    parentId={documentRootId}
                    onClose={() => setCreateDialogVisible(false)}
                    onCreate={handleCreateDocument}
                />
            </View>
        );
    }
);

const styles = StyleSheet.create({
    sidebar: {
        flex: 1,
        width: SIDEBAR_WIDTH
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingLeft: 20,
        paddingRight: 8,
        height: 56
    },
    headerEmoji: {
        fontSize: 18
    },
    title: {
        fontSize: 18,
        fontWeight: "600",
        flex: 1
    },
    headerLabels: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        gap: 10
    },
    collapseButton: {
        position: "absolute",
        top: 12,
        width: 32,
        height: 32,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center"
    },
    collapseIcon: {
        position: "absolute",
        alignItems: "center",
        justifyContent: "center",
        width: 32,
        height: 32
    },
    treeContainer: {
        flex: 1,
        paddingHorizontal: 8
    },
    groupSpacer: {
        marginTop: 12
    },
    modeRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingHorizontal: 12,
        height: 36,
        borderRadius: 8,
        marginVertical: 1,
        position: "relative"
    },
    activeRowBg: {
        position: "absolute",
        top: 0,
        left: 0,
        height: 36,
        borderRadius: 8
    },
    modeLabelRow: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        gap: 10
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
    }
});
