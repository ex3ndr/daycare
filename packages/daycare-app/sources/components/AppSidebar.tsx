import { Octicons } from "@expo/vector-icons";
import { type Href, usePathname, useRouter } from "expo-router";
import * as React from "react";
import { Pressable, ScrollView, type StyleProp, Text, View, type ViewStyle } from "react-native";
import Animated, { type SharedValue, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { useConfigStore } from "@/modules/config/configContext";
import { miniAppIconResolve } from "@/modules/mini-apps/miniAppIconResolve";
import { useMiniAppsStore } from "@/modules/mini-apps/miniAppsContext";
import { MINI_APPS_EMPTY } from "@/modules/mini-apps/miniAppsStoreCreate";
import { type AppMode, appModes } from "@/modules/navigation/appModes";
import { useWorkspace } from "@/modules/workspaces/workspaceProvider";
import { useWorkspacesStore } from "@/modules/workspaces/workspacesContext";
import type { WorkspaceListItem } from "@/modules/workspaces/workspacesFetch";

export const SIDEBAR_WIDTH = 240;
export const SIDEBAR_COLLAPSED_WIDTH = 56;

type Segment = {
    key: string;
    mode: AppMode;
    icon: React.ComponentProps<typeof Octicons>["name"];
    label: string;
    itemId?: string;
};

/** Sidebar items grouped with visual spacing between groups. */
const segmentGroups: Segment[][] = [
    [{ key: "home", mode: "home", icon: "home", label: "Home" }],
    [
        { key: "agents", mode: "agents", icon: "device-desktop", label: "Agents" },
        { key: "fragments", mode: "fragments", icon: "note", label: "Fragments" },
        { key: "automations", mode: "automations", icon: "clock", label: "Automations" },
        { key: "files", mode: "files", icon: "file-directory", label: "Files" },
        { key: "vault", mode: "vault", icon: "file", label: "Vault" },
        { key: "skills", mode: "skills", icon: "zap", label: "Skills" },
        { key: "tools", mode: "tools", icon: "tools", label: "Tools" },
        { key: "members", mode: "members", icon: "people", label: "Members" },
        { key: "costs", mode: "costs", icon: "credit-card", label: "Costs" }
    ]
];

/** Bottom-pinned items shown as icons in the workspace strip. */
const stripBottomSegments: Segment[] = [
    { key: "dev", mode: "dev", icon: "code-square", label: "Dev" },
    { key: "settings", mode: "settings", icon: "gear", label: "Settings" }
];

/** Sub-items for each mode that expand when the mode is active. */
const modeItems: Record<AppMode, Array<{ id: string; title: string }>> = {
    home: [],
    "mini-apps": [],
    agents: [],
    fragments: [],
    automations: [],
    costs: [],
    vault: [],
    files: [],
    skills: [],
    tools: [],
    members: [],
    dev: [],
    settings: []
};

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
export const WorkspaceStrip = React.memo<{ onNavigate?: () => void; style?: StyleProp<ViewStyle> }>(
    ({ onNavigate, style }) => {
        const { theme } = useUnistyles();
        const router = useRouter();
        const pathname = usePathname();
        const workspaces = useWorkspacesStore((s) => s.workspaces);
        const { workspaceId } = useWorkspace();
        const appReady = useConfigStore((s) => s.configFor(workspaceId).appReady);
        const activeMode = extractModeFromPath(pathname);
        const wsPrefix = workspaceId ? `/${workspaceId}` : "";

        const handleWorkspaceSwitch = React.useCallback(
            (userId: string) => {
                router.replace(`/${userId}/home` as Href);
                onNavigate?.();
            },
            [router, onNavigate]
        );

        const handleModePress = React.useCallback(
            (mode: AppMode) => {
                router.replace(`${wsPrefix}/${mode}` as Href);
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
                                isActive={ws.userId === workspaceId}
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
                                isActive={ws.userId === workspaceId}
                                onPress={() => handleWorkspaceSwitch(ws.userId)}
                            />
                        ))}
                </View>
                {appReady && (
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
                                        color={
                                            isActive ? theme.colors.onPrimaryContainer : theme.colors.onSurfaceVariant
                                        }
                                    />
                                </Pressable>
                            );
                        })}
                    </View>
                )}
            </View>
        );
    }
);

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

        const activeMode = extractModeFromPath(pathname);
        const selectedItem = extractItemFromPath(pathname);
        const { workspaceId, workspace: activeWorkspace } = useWorkspace();
        const miniApps = useMiniAppsStore((state) => state.appsByWorkspace[workspaceId] ?? MINI_APPS_EMPTY);
        const visibleSegmentGroups = React.useMemo(() => {
            const staticGroups = segmentGroups.map((group) =>
                group.filter((segment) => !(segment.mode === "members" && activeWorkspace?.isSelf === true))
            );
            const miniAppGroup = miniApps.map((app) => ({
                key: `mini-app-${app.id}`,
                mode: "mini-apps" as const,
                icon: miniAppIconResolve(app.icon),
                label: app.title,
                itemId: app.id
            }));
            return miniAppGroup.length > 0
                ? [...staticGroups.slice(0, 1), miniAppGroup, ...staticGroups.slice(1)]
                : staticGroups;
        }, [activeWorkspace?.isSelf, miniApps]);

        const wsPrefix = workspaceId ? `/${workspaceId}` : "";

        const handleModePress = React.useCallback(
            (mode: AppMode, itemId?: string) => {
                router.replace((itemId ? `${wsPrefix}/${mode}/${itemId}` : `${wsPrefix}/${mode}`) as Href);
                onNavigate?.();
            },
            [router, onNavigate, wsPrefix]
        );

        const handleItemPress = React.useCallback(
            (mode: AppMode, itemId: string) => {
                router.replace(`${wsPrefix}/${mode}/${itemId}` as Href);
                onNavigate?.();
            },
            [router, onNavigate, wsPrefix]
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
                    {visibleSegmentGroups.map((group, groupIndex) => (
                        <View
                            key={group.map((s) => s.key).join("-")}
                            style={groupIndex > 0 ? styles.groupSpacer : undefined}
                        >
                            {group.map((seg) => {
                                const isActive =
                                    activeMode === seg.mode &&
                                    (seg.itemId ? selectedItem === seg.itemId : seg.mode !== "mini-apps");
                                const items = modeItems[seg.mode];
                                const hasItems = items.length > 0;
                                const testId = seg.itemId ? `sidebar-mini-app-${seg.itemId}` : `sidebar-${seg.mode}`;

                                return (
                                    <View key={seg.key}>
                                        <Pressable
                                            testID={testId}
                                            onPress={() => handleModePress(seg.mode, seg.itemId)}
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

                                        {/* Static sub-items for other modes */}
                                        {!collapsed && isActive && hasItems && (
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
