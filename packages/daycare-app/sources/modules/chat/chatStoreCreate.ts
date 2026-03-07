import { create } from "zustand";
import { chatCreate, chatHistoryFetch, chatMessageSend, chatMessagesPoll } from "./chatApi";
import type { AgentHistoryRecord } from "./chatHistoryTypes";

export type ChatCreateInput = {
    systemPrompt: string;
    name?: string;
    description?: string;
};

export type ChatSessionState = {
    agentId: string;
    history: AgentHistoryRecord[];
    loading: boolean;
    sending: boolean;
    error: string | null;
    lastPollAt: number;
};

export type ChatStore = {
    sessions: Record<string, ChatSessionState>;
    open: (baseUrl: string, token: string, workspaceNametag: string | null, agentId: string) => Promise<void>;
    create: (
        baseUrl: string,
        token: string,
        workspaceNametag: string | null,
        input: ChatCreateInput
    ) => Promise<string>;
    send: (
        baseUrl: string,
        token: string,
        workspaceNametag: string | null,
        agentId: string,
        text: string
    ) => Promise<void>;
    poll: (baseUrl: string, token: string, workspaceNametag: string | null, agentId: string) => Promise<void>;
};

function chatSessionDefault(agentId: string): ChatSessionState {
    return {
        agentId,
        history: [],
        loading: false,
        sending: false,
        error: null,
        lastPollAt: 0
    };
}

function chatLastPollAtResolve(history: AgentHistoryRecord[]): number {
    return history.reduce((max, record) => (record.at > max ? record.at : max), 0);
}

/**
 * Creates a global chat store keyed by agent id.
 * Expects: baseUrl/token are authenticated values from auth state.
 */
export function chatStoreCreate() {
    return create<ChatStore>((set, get) => ({
        sessions: {},
        open: async (baseUrl, token, workspaceNametag, agentId) => {
            const existing = get().sessions[agentId] ?? chatSessionDefault(agentId);
            set({
                sessions: {
                    ...get().sessions,
                    [agentId]: {
                        ...existing,
                        loading: true,
                        error: null
                    }
                }
            });
            try {
                const history = await chatHistoryFetch(baseUrl, token, workspaceNametag, agentId);
                set({
                    sessions: {
                        ...get().sessions,
                        [agentId]: {
                            ...existing,
                            history,
                            loading: false,
                            error: null,
                            lastPollAt: chatLastPollAtResolve(history)
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
                            error: error instanceof Error ? error.message : "Failed to open chat session"
                        }
                    }
                });
            }
        },
        create: async (baseUrl, token, workspaceNametag, input) => {
            const created = await chatCreate(
                baseUrl,
                token,
                workspaceNametag,
                input.systemPrompt,
                input.name,
                input.description
            );
            const history = await chatHistoryFetch(baseUrl, token, workspaceNametag, created.agentId);
            set({
                sessions: {
                    ...get().sessions,
                    [created.agentId]: {
                        agentId: created.agentId,
                        history,
                        loading: false,
                        sending: false,
                        error: null,
                        lastPollAt: chatLastPollAtResolve(history)
                    }
                }
            });
            return created.agentId;
        },
        send: async (baseUrl, token, workspaceNametag, agentId, text) => {
            const existing = get().sessions[agentId] ?? chatSessionDefault(agentId);
            set({
                sessions: {
                    ...get().sessions,
                    [agentId]: {
                        ...existing,
                        sending: true,
                        error: null
                    }
                }
            });
            try {
                await chatMessageSend(baseUrl, token, workspaceNametag, agentId, text);
                const records = await chatMessagesPoll(baseUrl, token, workspaceNametag, agentId, existing.lastPollAt);
                const history = [...existing.history, ...records];
                set({
                    sessions: {
                        ...get().sessions,
                        [agentId]: {
                            ...existing,
                            history,
                            sending: false,
                            error: null,
                            lastPollAt: chatLastPollAtResolve(history)
                        }
                    }
                });
            } catch (error) {
                set({
                    sessions: {
                        ...get().sessions,
                        [agentId]: {
                            ...existing,
                            sending: false,
                            error: error instanceof Error ? error.message : "Failed to send chat message"
                        }
                    }
                });
            }
        },
        poll: async (baseUrl, token, workspaceNametag, agentId) => {
            const existing = get().sessions[agentId] ?? chatSessionDefault(agentId);
            try {
                const records = await chatMessagesPoll(baseUrl, token, workspaceNametag, agentId, existing.lastPollAt);
                if (records.length === 0) {
                    return;
                }
                const history = [...existing.history, ...records];
                set({
                    sessions: {
                        ...get().sessions,
                        [agentId]: {
                            ...existing,
                            history,
                            error: null,
                            lastPollAt: chatLastPollAtResolve(history)
                        }
                    }
                });
            } catch (error) {
                set({
                    sessions: {
                        ...get().sessions,
                        [agentId]: {
                            ...existing,
                            error: error instanceof Error ? error.message : "Failed to poll chat messages"
                        }
                    }
                });
            }
        }
    }));
}
