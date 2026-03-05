import type { PropsWithChildren, ReactNode } from "react";
import * as React from "react";
import { useAgentsStore } from "@/modules/agents/agentsContext";
import { useAuthStore } from "@/modules/auth/authContext";
import { useSyncStore } from "./syncContext";

/**
 * Connects/disconnects SSE sync based on auth state.
 * Triggers full agent refetch on each (re)connection.
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

    // Connect/disconnect based on auth state
    React.useEffect(() => {
        if (authState === "authenticated" && baseUrl && token) {
            connect(baseUrl, token);
        } else {
            disconnect();
        }
        return () => {
            disconnect();
        };
    }, [authState, baseUrl, token, connect, disconnect]);

    // Refetch agents when sync becomes connected (initial connect or reconnect)
    React.useEffect(() => {
        if (syncStatus === "connected" && baseUrl && token) {
            void fetchAgents(baseUrl, token);
        }
    }, [syncStatus, baseUrl, token, fetchAgents]);

    return <>{children}</>;
}
