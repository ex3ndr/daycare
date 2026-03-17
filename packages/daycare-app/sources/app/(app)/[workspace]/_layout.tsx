import { Stack, useLocalSearchParams } from "expo-router";
import * as React from "react";
import { View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { AppSidebar, SIDEBAR_COLLAPSED_WIDTH, SIDEBAR_WIDTH } from "@/components/AppSidebar";
import { useConfigStore } from "@/modules/config/configContext";
import { WorkspaceSync } from "@/modules/sync/WorkspaceSync";
import { useWorkspace, WorkspaceProvider } from "@/modules/workspaces/workspaceProvider";
import { useWorkspacesStore } from "@/modules/workspaces/workspacesContext";

const SIDEBAR_KEY = "daycare:sidebar-collapsed";

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

/**
 * Workspace layout: resolves workspace from route params, provides WorkspaceProvider,
 * and renders the sidebar/drawer chrome around child screens.
 */
export default function WorkspaceLayout() {
    const { workspace: workspaceId } = useLocalSearchParams<{ workspace: string }>();
    const { theme } = useUnistyles();
    const isMobile = theme.layout.isMobileLayout;
    const workspaces = useWorkspacesStore((s) => s.workspaces);
    const workspace = React.useMemo(
        () => workspaces.find((w) => w.userId === workspaceId) ?? null,
        [workspaceId, workspaces]
    );

    if (!workspace || !workspaceId) {
        return null;
    }

    const stack = (
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.surface } }}>
            <Stack.Screen name="(tabs)" />
        </Stack>
    );

    return (
        <WorkspaceProvider workspaceId={workspaceId} workspace={workspace}>
            <WorkspaceSync>
                {isMobile ? <MobileShell>{stack}</MobileShell> : <DesktopShell>{stack}</DesktopShell>}
            </WorkspaceSync>
        </WorkspaceProvider>
    );
}

/** Desktop: sidebar on left, content on right. */
function DesktopShell({ children }: { children: React.ReactNode }) {
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

    return (
        <View style={[styles.root, { backgroundColor: theme.colors.surfaceContainerLow }]}>
            {appReady && (
                <Animated.View
                    style={[
                        styles.sidebarArea,
                        sidebarAnimatedStyle,
                        { backgroundColor: theme.colors.surfaceContainerLow, paddingTop: insets.top }
                    ]}
                >
                    <AppSidebar
                        onToggleCollapse={toggleSidebar}
                        labelsOpacity={labelsOpacity}
                        sidebarWidth={sidebarWidth}
                        collapsed={sidebarCollapsed}
                    />
                </Animated.View>
            )}
            <View style={[styles.contentArea, { backgroundColor: theme.colors.surface }]}>{children}</View>
        </View>
    );
}

/** Mobile: full-screen content with bottom tabs and stack navigation. */
function MobileShell({ children }: { children: React.ReactNode }) {
    const { theme } = useUnistyles();

    return <View style={[styles.mobileRoot, { backgroundColor: theme.colors.surface }]}>{children}</View>;
}

const styles = StyleSheet.create({
    // Desktop
    root: {
        flexGrow: 1,
        flexBasis: 0,
        flexDirection: "row"
    },
    sidebarArea: {
        overflow: "hidden",
        flexShrink: 0
    },
    contentArea: {
        flex: 1,
        overflow: "hidden"
    },

    // Mobile
    mobileRoot: {
        flex: 1
    }
});
