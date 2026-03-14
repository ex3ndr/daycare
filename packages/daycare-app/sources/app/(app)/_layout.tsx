import { Redirect, Stack, usePathname } from "expo-router";
import * as React from "react";
import { useAuthStore } from "@/modules/auth/authContext";
import { useConfigStore } from "@/modules/config/configContext";
import { useMiniAppsStore } from "@/modules/mini-apps/miniAppsContext";
import { routeDebugLog } from "@/modules/navigation/routeDebugLog";
import { useWorkspacesStore } from "@/modules/workspaces/workspacesContext";

const REFRESH_INTERVAL_MS = 60_000;

/**
 * Authenticated app layout. Loads workspaces and their config flags,
 * refreshes periodically, and redirects when auth becomes unavailable.
 */
export default function AuthenticatedLayout() {
    const authState = useAuthStore((s) => s.state);
    const baseUrl = useAuthStore((s) => s.baseUrl);
    const token = useAuthStore((s) => s.token);
    const pathname = usePathname();
    const fetchWorkspaces = useWorkspacesStore((s) => s.fetch);
    const workspacesLoaded = useWorkspacesStore((s) => s.loaded);
    const workspaces = useWorkspacesStore((s) => s.workspaces);
    const fetchAllConfigs = useConfigStore((s) => s.fetchAll);
    const fetchAllMiniApps = useMiniAppsStore((s) => s.fetchAll);
    const configLoaded = useConfigStore((s) => s.loaded);
    const workspaceIds = React.useMemo(() => workspaces.map((workspace) => workspace.userId), [workspaces]);

    React.useEffect(() => {
        routeDebugLog("app-layout-state", {
            pathname,
            authState,
            workspacesLoaded,
            configLoaded,
            workspaceIds
        });
    }, [pathname, authState, workspacesLoaded, configLoaded, workspaceIds]);

    // Load workspaces on mount
    React.useEffect(() => {
        if (authState === "authenticated" && baseUrl && token) {
            void fetchWorkspaces(baseUrl, token);
        }
    }, [authState, baseUrl, token, fetchWorkspaces]);

    // Load configs once workspaces are available
    React.useEffect(() => {
        if (workspacesLoaded && baseUrl && token && workspaces.length > 0) {
            void fetchAllConfigs(baseUrl, token, workspaceIds);
            void fetchAllMiniApps(baseUrl, token, workspaceIds);
        }
    }, [workspacesLoaded, baseUrl, token, workspaces.length, workspaceIds, fetchAllConfigs, fetchAllMiniApps]);

    // Periodic refresh of workspaces and configs
    React.useEffect(() => {
        if (!workspacesLoaded || !baseUrl || !token) return;

        const interval = setInterval(() => {
            void fetchWorkspaces(baseUrl, token);
            if (workspaces.length > 0) {
                void fetchAllConfigs(baseUrl, token, workspaceIds);
                void fetchAllMiniApps(baseUrl, token, workspaceIds);
            }
        }, REFRESH_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [
        workspacesLoaded,
        baseUrl,
        token,
        workspaces.length,
        workspaceIds,
        fetchWorkspaces,
        fetchAllConfigs,
        fetchAllMiniApps
    ]);

    // Redirect when auth drops
    if (authState !== "authenticated") {
        routeDebugLog("app-redirect", {
            pathname,
            authState,
            target: "/"
        });
        return <Redirect href="/" />;
    }

    // Wait for workspaces and configs before mounting the Stack.
    // When there are no workspaces, config fetch never fires, so skip the config check.
    const needsConfigLoad = workspaces.length > 0;
    if (!workspacesLoaded || (needsConfigLoad && !configLoaded)) {
        routeDebugLog("app-gate-block", {
            pathname,
            workspacesLoaded,
            configLoaded,
            workspaceIds
        });
        return null;
    }

    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="[workspace]" />
            <Stack.Screen name="invite" />
        </Stack>
    );
}
