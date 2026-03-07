import type { PropsWithChildren, ReactNode } from "react";
import * as React from "react";
import { useAgentsStore } from "@/modules/agents/agentsContext";
import { useAuthStore } from "@/modules/auth/authContext";
import { useObservationsStore } from "@/modules/observations/observationsContext";
import { useTasksStore } from "@/modules/tasks/tasksContext";
import { useWorkspacesStore } from "@/modules/workspaces/workspacesContext";
import { useSyncStore } from "./syncContext";

/**
 * Connects/disconnects SSE sync based on auth state.
 * Triggers full agent refetch on each (re)connection.
 * Fetches workspaces on initial auth.
 *
 * Expects: placed inside AuthProvider so auth state is available.
 */
export function SyncProvider({ children }: PropsWithChildren): ReactNode {
    const authState = useAuthStore((s) => s.state);
    const baseUrl = useAuthStore((s) => s.baseUrl);
    const token = useAuthStore((s) => s.token);
    const connect = useSyncStore((s) => s.connect);
    const disconnect = useSyncStore((s) => s.disconnect);
    const syncStatus = useSyncStore((s) => s.status);
    const fetchAgents = useAgentsStore((s) => s.fetch);
    const fetchObservations = useObservationsStore((s) => s.fetch);
    const fetchTasks = useTasksStore((s) => s.fetch);
    const fetchWorkspaces = useWorkspacesStore((s) => s.fetch);
    const activeNametag = useWorkspacesStore((s) => s.activeNametag);

    // Fetch workspaces when authenticated
    React.useEffect(() => {
        if (authState === "authenticated" && baseUrl && token) {
            void fetchWorkspaces(baseUrl, token);
        }
    }, [authState, baseUrl, token, fetchWorkspaces]);

    // Connect/disconnect based on auth state and active workspace
    React.useEffect(() => {
        if (authState === "authenticated" && baseUrl && token) {
            connect(baseUrl, token, activeNametag);
        } else {
            disconnect();
        }
        return () => {
            disconnect();
        };
    }, [authState, baseUrl, token, activeNametag, connect, disconnect]);

    // Refetch stores when sync becomes connected (initial connect or reconnect)
    React.useEffect(() => {
        if (syncStatus === "connected" && baseUrl && token) {
            void fetchAgents(baseUrl, token, activeNametag);
            void fetchObservations(baseUrl, token, activeNametag);
            void fetchTasks(baseUrl, token, activeNametag);
        }
    }, [syncStatus, baseUrl, token, activeNametag, fetchAgents, fetchObservations, fetchTasks]);

    return <>{children}</>;
}
