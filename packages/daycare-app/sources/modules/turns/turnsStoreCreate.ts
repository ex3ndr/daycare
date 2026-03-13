import { create } from "zustand";
import { turnsFetch } from "./turnsApi";
import type { AgentTurn } from "./turnTypes";

export type TurnsSessionState = {
    agentId: string;
    turns: AgentTurn[];
    loading: boolean;
    error: string | null;
    selectedTurnIndex: number | null;
};

export type TurnsStore = {
    sessions: Record<string, TurnsSessionState>;
    open: (baseUrl: string, token: string, workspaceId: string | null, agentId: string) => Promise<void>;
    poll: (baseUrl: string, token: string, workspaceId: string | null, agentId: string) => Promise<void>;
    selectTurn: (agentId: string, turnIndex: number | null) => void;
};

function turnsSessionDefault(agentId: string): TurnsSessionState {
    return {
        agentId,
        turns: [],
        loading: false,
        error: null,
        selectedTurnIndex: null
    };
}

/**
 * Creates a global turns store keyed by agent id.
 * Expects: baseUrl/token are authenticated values from auth state.
 */
export function turnsStoreCreate() {
    return create<TurnsStore>((set, get) => ({
        sessions: {},
        open: async (baseUrl, token, workspaceId, agentId) => {
            const existing = get().sessions[agentId] ?? turnsSessionDefault(agentId);
            set({
                sessions: {
                    ...get().sessions,
                    [agentId]: { ...existing, loading: true, error: null }
                }
            });
            try {
                const turns = await turnsFetch(baseUrl, token, workspaceId, agentId);
                set({
                    sessions: {
                        ...get().sessions,
                        [agentId]: {
                            ...turnsSessionDefault(agentId),
                            turns,
                            selectedTurnIndex: turns.length > 0 ? turns[turns.length - 1].index : null
                        }
                    }
                });
            } catch (error) {
                set({
                    sessions: {
                        ...get().sessions,
                        [agentId]: {
                            ...existing,
                            loading: false,
                            error: error instanceof Error ? error.message : "Failed to load turns"
                        }
                    }
                });
            }
        },
        poll: async (baseUrl, token, workspaceId, agentId) => {
            const existing = get().sessions[agentId];
            if (!existing) return;
            try {
                const turns = await turnsFetch(baseUrl, token, workspaceId, agentId);
                const prevSelected = existing.selectedTurnIndex;
                set({
                    sessions: {
                        ...get().sessions,
                        [agentId]: {
                            ...existing,
                            turns,
                            error: null,
                            selectedTurnIndex: prevSelected
                        }
                    }
                });
            } catch {
                // Silently ignore poll errors
            }
        },
        selectTurn: (agentId, turnIndex) => {
            const existing = get().sessions[agentId];
            if (!existing) return;
            set({
                sessions: {
                    ...get().sessions,
                    [agentId]: { ...existing, selectedTurnIndex: turnIndex }
                }
            });
        }
    }));
}
