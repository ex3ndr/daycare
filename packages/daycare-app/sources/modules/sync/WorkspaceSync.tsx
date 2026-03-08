import type { PropsWithChildren, ReactNode } from "react";
import * as React from "react";
import { useAgentsStore } from "@/modules/agents/agentsContext";
import { useAuthStore } from "@/modules/auth/authContext";
import { useConfigStore } from "@/modules/config/configContext";
import { useObservationsStore } from "@/modules/observations/observationsContext";
import { useTasksStore } from "@/modules/tasks/tasksContext";
import { useWorkspace } from "@/modules/workspaces/workspaceProvider";
import { useSyncStore } from "./syncContext";

/**
 * Runs workspace-scoped sync effects after the layout has resolved workspace access.
 * Fetches workspace config BEFORE rendering children, then keeps it synced via SSE.
 * Expects: rendered inside WorkspaceProvider.
 */
export function WorkspaceSync({ children }: PropsWithChildren): ReactNode {
    const authState = useAuthStore((s) => s.state);
    const baseUrl = useAuthStore((s) => s.baseUrl);
    const token = useAuthStore((s) => s.token);
    const connect = useSyncStore((s) => s.connect);
    const disconnect = useSyncStore((s) => s.disconnect);
    const syncStatus = useSyncStore((s) => s.status);
    const fetchAgents = useAgentsStore((s) => s.fetch);
    const fetchObservations = useObservationsStore((s) => s.fetch);
    const fetchTasks = useTasksStore((s) => s.fetch);
    const fetchConfig = useConfigStore((s) => s.fetch);
    const configLoaded = useConfigStore((s) => s.loaded);
    const resetConfig = useConfigStore((s) => s.reset);
    const { workspaceId } = useWorkspace();

    // Fetch workspace config eagerly, before SSE connects
    React.useEffect(() => {
        if (authState === "authenticated" && baseUrl && token) {
            void fetchConfig(baseUrl, token, workspaceId);
        }
        return () => {
            resetConfig();
        };
    }, [authState, baseUrl, token, workspaceId, fetchConfig, resetConfig]);

    React.useEffect(() => {
        if (authState === "authenticated" && baseUrl && token) {
            connect(baseUrl, token, workspaceId);
        } else {
            disconnect();
        }
        return () => {
            disconnect();
        };
    }, [authState, baseUrl, token, workspaceId, connect, disconnect]);

    React.useEffect(() => {
        if (syncStatus === "connected" && baseUrl && token) {
            void fetchAgents(baseUrl, token, workspaceId);
            void fetchObservations(baseUrl, token, workspaceId);
            void fetchTasks(baseUrl, token, workspaceId);
        }
    }, [syncStatus, baseUrl, token, workspaceId, fetchAgents, fetchObservations, fetchTasks]);

    // Block rendering until workspace config is loaded
    if (!configLoaded) {
        return null;
    }

    return <>{children}</>;
}
