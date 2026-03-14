import { Octicons } from "@expo/vector-icons";
import { type Href, Navigator, Redirect, type ScreenProps, usePathname } from "expo-router";
import * as React from "react";
import { Pressable, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import {
    AppSidebar,
    SIDEBAR_COLLAPSED_WIDTH,
    SIDEBAR_WIDTH,
    WORKSPACE_STRIP_WIDTH,
    WorkspaceStrip
} from "@/components/AppSidebar";
import { CHAT_COLLAPSED_WIDTH, CHAT_PANEL_WIDTH, ChatPanel } from "@/components/ChatPanel";
import { Drawer } from "@/components/Drawer";
import { useConfigStore } from "@/modules/config/configContext";
import { routeDebugLog } from "@/modules/navigation/routeDebugLog";
import { WorkspaceSync } from "@/modules/sync/WorkspaceSync";
import { workspaceRouteIdResolve } from "@/modules/workspaces/workspaceIdResolve";
import { useWorkspace, WorkspaceProvider } from "@/modules/workspaces/workspaceProvider";
import { useWorkspacesStore } from "@/modules/workspaces/workspacesContext";

const SIDEBAR_KEY = "daycare:sidebar-collapsed";
const CHAT_KEY = "daycare:chat-collapsed";
// Expo Router's Navigator.Screen runtime supports singular screen props, but its exported type omits them.
const LayoutScreen = Navigator.Screen as unknown as React.ComponentType<ScreenProps>;

function workspaceRouteSingularId(_name: string, params: Record<string, unknown>): string | undefined {
    return typeof params.workspace === "string" ? params.workspace : undefined;
}

function panelStateRead(key: string, fallback: boolean): boolean {
    try {
        const v = window.localStorage.getItem(key);
        if (v === "true") return true;
        if (v === "false") return false;
    } catch {}
    return fallback;
}

function panelStateWrite(key: string, collapsed: boolean): void {
    try {
        window.localStorage.setItem(key, String(collapsed));
    } catch {}
}

export default function AppLayout() {
    const { theme } = useUnistyles();
    const pathname = usePathname();
    const workspaces = useWorkspacesStore((state) => state.workspaces);
    const workspaceIds = React.useMemo(() => workspaces.map((workspace) => workspace.userId), [workspaces]);
    const routeWorkspaceId = React.useMemo(() => workspaceRouteIdResolve(pathname), [pathname]);
    const isMobile = theme.layout.isMobileLayout;
    const workspace = React.useMemo(
        () => workspaces.find((item) => item.userId === routeWorkspaceId) ?? null,
        [routeWorkspaceId, workspaces]
    );
    const defaultWorkspaceId = React.useMemo(
        () => workspaces.find((item) => item.isSelf)?.userId ?? workspaces[0]?.userId ?? null,
        [workspaces]
    );
    const redirect = React.useMemo<{ href: Href; reason: string } | null>(() => {
        if (!routeWorkspaceId) {
            return defaultWorkspaceId
                ? {
                      href: `/${defaultWorkspaceId}/home` as Href,
                      reason: "missing-route-workspace"
                  }
                : {
                      href: "/workspace-not-found" as Href,
                      reason: "no-default-workspace"
                  };
        }
        if (!workspace) {
            return {
                href: "/workspace-not-found" as Href,
                reason: "workspace-not-in-store"
            };
        }
        return null;
    }, [routeWorkspaceId, defaultWorkspaceId, workspace]);
    const redirectHref = React.useMemo(() => {
        if (!redirect) {
            return null;
        }
        return typeof redirect.href === "string" ? redirect.href : redirect.href.pathname;
    }, [redirect]);
    const redirectReason = redirect?.reason ?? null;

    React.useEffect(() => {
        routeDebugLog("main-layout-state", {
            pathname,
            routeWorkspaceId,
            defaultWorkspaceId,
            workspaceIds,
            matchedWorkspaceId: workspace?.userId ?? null,
            redirectReason,
            redirectHref
        });
    }, [pathname, routeWorkspaceId, defaultWorkspaceId, workspaceIds, workspace?.userId, redirectReason, redirectHref]);

    // Workspaces are guaranteed loaded by the (app) layout gate
    if (redirect) {
        return <Redirect href={redirect.href} />;
    }
    if (!workspace) {
        return null;
    }

    return (
        <WorkspaceProvider workspaceId={workspace.userId} workspace={workspace}>
            <WorkspaceSync>{isMobile ? <MobileLayout /> : <DesktopLayout />}</WorkspaceSync>
        </WorkspaceProvider>
    );
}

/** Desktop: sidebar on left, content in center, chat panel on right. */
function DesktopLayout() {
    const { theme } = useUnistyles();
    const insets = useSafeAreaInsets();
    const { workspaceId } = useWorkspace();
    const appReady = useConfigStore((s) => s.configFor(workspaceId).appReady);
    const initialSidebarCollapsed = React.useMemo(() => panelStateRead(SIDEBAR_KEY, true), []);
    const sidebarWidth = useSharedValue(initialSidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH);
    const labelsOpacity = useSharedValue(initialSidebarCollapsed ? 0 : 1);
    const [sidebarCollapsed, setSidebarCollapsed] = React.useState(initialSidebarCollapsed);

    const toggleSidebar = React.useCallback(() => {
        setSidebarCollapsed((prev) => {
            const next = !prev;
            panelStateWrite(SIDEBAR_KEY, next);
            sidebarWidth.value = withTiming(next ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH, { duration: 200 });
            labelsOpacity.value = withTiming(next ? 0 : 1, { duration: 120 });
            return next;
        });
    }, [sidebarWidth, labelsOpacity]);

    const sidebarAnimatedStyle = useAnimatedStyle(() => ({
        width: sidebarWidth.value
    }));

    // Chat panel state
    const initialChatCollapsed = React.useMemo(() => panelStateRead(CHAT_KEY, true), []);
    const chatWidth = useSharedValue(initialChatCollapsed ? CHAT_COLLAPSED_WIDTH : CHAT_PANEL_WIDTH);
    const chatLabelsOpacity = useSharedValue(initialChatCollapsed ? 0 : 1);

    const toggleChat = React.useCallback(() => {
        const isCollapsed = chatWidth.value <= CHAT_COLLAPSED_WIDTH;
        panelStateWrite(CHAT_KEY, !isCollapsed);
        chatWidth.value = withTiming(isCollapsed ? CHAT_PANEL_WIDTH : CHAT_COLLAPSED_WIDTH, { duration: 200 });
        chatLabelsOpacity.value = withTiming(isCollapsed ? 1 : 0, { duration: 120 });
    }, [chatWidth, chatLabelsOpacity]);

    const chatAnimatedStyle = useAnimatedStyle(() => ({
        width: chatWidth.value
    }));

    const cardMargins = {
        marginTop: 8 + insets.top,
        marginBottom: 8 + insets.bottom
    };
    const cardShadow = `0px 1px 2px ${theme.colors.shadow}0D, 0px 1px 3px ${theme.colors.shadow}14`;

    return (
        <Navigator>
            <LayoutScreen name="index" />
            <LayoutScreen name="[workspace]" dangerouslySingular={workspaceRouteSingularId} />
            <View style={[styles.root, { backgroundColor: theme.colors.surfaceContainerLow }]}>
                <WorkspaceStrip style={{ paddingTop: insets.top, paddingBottom: insets.bottom }} />
                {appReady && (
                    <Animated.View
                        style={[styles.sidebarCard, sidebarAnimatedStyle, { backgroundColor: theme.colors.surface }]}
                    >
                        <AppSidebar
                            onToggleCollapse={toggleSidebar}
                            labelsOpacity={labelsOpacity}
                            sidebarWidth={sidebarWidth}
                            collapsed={sidebarCollapsed}
                        />
                    </Animated.View>
                )}
                <View
                    style={[
                        styles.contentCard,
                        { ...cardMargins, backgroundColor: theme.colors.surface, boxShadow: cardShadow }
                    ]}
                >
                    <Navigator.Slot />
                </View>
                {appReady && (
                    <Animated.View
                        style={[
                            styles.chatCard,
                            chatAnimatedStyle,
                            {
                                ...cardMargins,
                                backgroundColor: theme.colors.surface,
                                boxShadow: cardShadow
                            }
                        ]}
                    >
                        <ChatPanel
                            onToggleCollapse={toggleChat}
                            labelsOpacity={chatLabelsOpacity}
                            panelWidth={chatWidth}
                        />
                    </Animated.View>
                )}
            </View>
        </Navigator>
    );
}

/** Mobile: full-screen content with a floating hamburger that opens a drawer. */
function MobileLayout() {
    const { theme } = useUnistyles();
    const insets = useSafeAreaInsets();
    const { workspaceId } = useWorkspace();
    const appReady = useConfigStore((s) => s.configFor(workspaceId).appReady);
    const [drawerOpen, setDrawerOpen] = React.useState(false);

    const openDrawer = React.useCallback(() => setDrawerOpen(true), []);
    const closeDrawer = React.useCallback(() => setDrawerOpen(false), []);

    const renderDrawerContent = React.useCallback(
        () => (
            <View style={styles.mobileDrawerContent}>
                <WorkspaceStrip onNavigate={closeDrawer} />
                <AppSidebar onNavigate={closeDrawer} />
            </View>
        ),
        [closeDrawer]
    );

    // When sidebars are hidden, render content directly without the drawer wrapper
    if (!appReady) {
        return (
            <Navigator>
                <LayoutScreen name="index" />
                <LayoutScreen name="[workspace]" dangerouslySingular={workspaceRouteSingularId} />
                <View style={[styles.mobileRoot, { backgroundColor: theme.colors.surfaceContainerLow }]}>
                    <View style={styles.content}>
                        <Navigator.Slot />
                    </View>
                </View>
            </Navigator>
        );
    }

    return (
        <Navigator>
            <LayoutScreen name="index" />
            <LayoutScreen name="[workspace]" dangerouslySingular={workspaceRouteSingularId} />
            <View style={[styles.mobileRoot, { backgroundColor: theme.colors.surfaceContainerLow }]}>
                <Drawer
                    isOpen={drawerOpen}
                    onClose={closeDrawer}
                    renderDrawer={renderDrawerContent}
                    width={WORKSPACE_STRIP_WIDTH + SIDEBAR_WIDTH + 16}
                    position="left"
                >
                    <View style={styles.content}>
                        <Navigator.Slot />
                    </View>
                </Drawer>

                {/* Floating hamburger button — flies above everything */}
                {!drawerOpen && (
                    <Pressable
                        onPress={openDrawer}
                        style={[
                            styles.hamburger,
                            {
                                top: 12 + insets.top,
                                backgroundColor: theme.colors.surface,
                                boxShadow: theme.elevation.level2
                            }
                        ]}
                    >
                        <Octicons name="three-bars" size={18} color={theme.colors.onSurface} />
                    </Pressable>
                )}
            </View>
        </Navigator>
    );
}

const styles = StyleSheet.create({
    // Desktop
    root: {
        flexGrow: 1,
        flexBasis: 0,
        flexDirection: "row",
        gap: 6,
        paddingHorizontal: 8
    },
    sidebarCard: {
        overflow: "hidden",
        flexShrink: 0
    },
    contentCard: {
        flex: 1,
        borderRadius: 8,
        overflow: "hidden"
    },
    chatCard: {
        borderTopLeftRadius: 8,
        borderBottomLeftRadius: 8,
        borderTopRightRadius: 16,
        borderBottomRightRadius: 16,
        overflow: "hidden",
        flexShrink: 0
    },
    content: {
        flex: 1
    },

    // Mobile
    mobileRoot: {
        flex: 1
    },
    mobileDrawerContent: {
        flex: 1,
        flexDirection: "row"
    },
    hamburger: {
        position: "absolute",
        left: 16,
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100
    }
});
