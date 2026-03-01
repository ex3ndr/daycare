import { create } from "zustand";
import { agentsFetch } from "./agentsFetch";
import type { AgentListItem } from "./agentsTypes";

export type AgentsStore = {
    agents: AgentListItem[];
    loading: boolean;
    error: string | null;
    fetch: (baseUrl: string, token: string) => Promise<void>;
};

/**
 * Creates a zustand store for agent list data.
 * Manages fetching and raw agent storage.
 */
export function agentsStoreCreate() {
    return create<AgentsStore>((set) => ({
        agents: [],
        loading: false,
        error: null,
        fetch: async (baseUrl, token) => {
            set({ loading: true, error: null });
            try {
                const agents = await agentsFetch(baseUrl, token);
                set({ agents, loading: false });
            } catch (err) {
                set({
                    loading: false,
                    error: err instanceof Error ? err.message : "Failed to fetch agents"
                });
            }
        }
    }));
}
