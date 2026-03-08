import { Redirect, Stack, usePathname } from "expo-router";
import * as React from "react";
import { useAuthStore } from "@/modules/auth/authContext";
import { useConfigStore } from "@/modules/config/configContext";
import { routeDebugLog } from "@/modules/navigation/routeDebugLog";
import { useWorkspacesStore } from "@/modules/workspaces/workspacesContext";

const REFRESH_INTERVAL_MS = 60_000;

const modalScreenOptions = {
    presentation: "modal" as const,
    animation: "fade_from_bottom" as const,
    webModalStyle: {
        width: "90vw",
        height: "90vh",
        minWidth: "min(1100px, 90vw)",
        minHeight: "min(800px, 90vh)"
    }
};

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
        }
    }, [workspacesLoaded, baseUrl, token, workspaces.length, workspaceIds, fetchAllConfigs]);

    // Periodic refresh of workspaces and configs
    React.useEffect(() => {
        if (!workspacesLoaded || !baseUrl || !token) return;

        const interval = setInterval(() => {
            void fetchWorkspaces(baseUrl, token);
            if (workspaces.length > 0) {
                void fetchAllConfigs(baseUrl, token, workspaceIds);
            }
        }, REFRESH_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [workspacesLoaded, baseUrl, token, workspaces.length, workspaceIds, fetchWorkspaces, fetchAllConfigs]);

    // Redirect when auth drops
    if (authState !== "authenticated") {
        routeDebugLog("app-redirect", {
            pathname,
            authState,
            target: "/"
        });
        return <Redirect href="/" />;
    }

    // Wait for workspaces before mounting the Stack.
    // The root Stack keeps (app) as a screen-slot, so returning null here is safe
    // and avoids child Navigator remount issues.
    if (!workspacesLoaded || !configLoaded) {
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
            <Stack.Screen name="(main)" />
            <Stack.Screen name="[workspace]/fragment/[id]" options={modalScreenOptions} />
            <Stack.Screen name="[workspace]/routine/[id]" options={modalScreenOptions} />
            <Stack.Screen name="[workspace]/todo/[id]" options={modalScreenOptions} />
            <Stack.Screen name="[workspace]/file-preview/[path]" options={modalScreenOptions} />
            <Stack.Screen name="share" />
            <Stack.Screen name="workspace-not-found" />
        </Stack>
    );
}
