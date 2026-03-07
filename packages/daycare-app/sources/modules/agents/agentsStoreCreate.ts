import { create } from "zustand";
import { agentsFetch } from "./agentsFetch";
import type { AgentListItem } from "./agentsTypes";

export type AgentsStore = {
    agents: AgentListItem[];
    loading: boolean;
    error: string | null;
    fetch: (baseUrl: string, token: string, workspaceId: string | null) => Promise<void>;
    applyCreated: (agent: AgentListItem) => void;
    applyUpdated: (partial: { agentId: string; updatedAt?: number } & Partial<AgentListItem>) => void;
    applyDeleted: (agentId: string) => void;
};

/**
 * Creates a zustand store for the agent list.
 * Supports full fetch and delta merges from SSE sync events.
 *
 * Expects: baseUrl/token come from authenticated app state.
 */
export function agentsStoreCreate() {
    return create<AgentsStore>((set, get) => ({
        agents: [],
        loading: false,
        error: null,
        fetch: async (baseUrl, token, workspaceId) => {
            set({ loading: true, error: null });
            try {
                const agents = await agentsFetch(baseUrl, token, workspaceId);
                set({ agents, loading: false });
            } catch (err) {
                set({
                    loading: false,
                    error: err instanceof Error ? err.message : "Failed to fetch agents"
                });
            }
        },
        applyCreated: (agent) => {
            const existing = get().agents;
            if (existing.some((a) => a.agentId === agent.agentId)) {
                return;
            }
            set({ agents: [agent, ...existing] });
        },
        applyUpdated: (partial) => {
            const existing = get().agents;
            const index = existing.findIndex((a) => a.agentId === partial.agentId);
            if (index === -1) {
                return;
            }
            const current = existing[index];
            // Skip stale events using updatedAt
            if (partial.updatedAt !== undefined && current.updatedAt >= partial.updatedAt) {
                return;
            }
            const updated = { ...current, ...partial };
            const next = [...existing];
            next[index] = updated;
            set({ agents: next });
        },
        applyDeleted: (agentId) => {
            const existing = get().agents;
            const filtered = existing.filter((a) => a.agentId !== agentId);
            if (filtered.length !== existing.length) {
                set({ agents: filtered });
            }
        }
    }));
}
