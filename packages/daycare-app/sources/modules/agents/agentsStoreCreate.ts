import { create } from "zustand";
import type { AgentHistoryRecord } from "@/views/agents/agentHistoryTypes";
import { agentsFetch } from "./agentsFetch";
import { agentsHistoryFetch } from "./agentsHistoryFetch";
import { agentsMessageSend } from "./agentsMessageSend";
import type { AgentListItem } from "./agentsTypes";

export type AgentsStore = {
    agents: AgentListItem[];
    loading: boolean;
    error: string | null;
    fetch: (baseUrl: string, token: string) => Promise<void>;

    history: AgentHistoryRecord[];
    historyLoading: boolean;
    historyError: string | null;
    fetchHistory: (baseUrl: string, token: string, agentId: string) => Promise<void>;
    sendMessage: (baseUrl: string, token: string, agentId: string, text: string) => Promise<void>;
};

/**
 * Creates a zustand store for agent list and history data.
 * Manages fetching agents, loading history, and sending messages.
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
        },

        history: [],
        historyLoading: false,
        historyError: null,
        fetchHistory: async (baseUrl, token, agentId) => {
            set({ historyLoading: true, historyError: null });
            try {
                const history = await agentsHistoryFetch(baseUrl, token, agentId);
                set({ history, historyLoading: false });
            } catch (err) {
                set({
                    historyLoading: false,
                    historyError: err instanceof Error ? err.message : "Failed to fetch history"
                });
            }
        },
        sendMessage: async (baseUrl, token, agentId, text) => {
            await agentsMessageSend(baseUrl, token, agentId, text);
        }
    }));
}
