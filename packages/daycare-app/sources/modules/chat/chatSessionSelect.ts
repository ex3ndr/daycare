import type { ChatSessionState } from "./chatStoreCreate";

export type ChatSessionView = Pick<ChatSessionState, "history" | "loading" | "sending" | "error">;

const CHAT_SESSION_EMPTY: ChatSessionView = {
    history: [],
    loading: false,
    sending: false,
    error: null
};

/**
 * Selects the visible chat session view from keyed sessions.
 * Expects: sessions is the current store map and agentId is the active session id or null.
 */
export function chatSessionSelect(sessions: Record<string, ChatSessionState>, agentId: string | null): ChatSessionView {
    if (!agentId) {
        return CHAT_SESSION_EMPTY;
    }
    const session = sessions[agentId];
    if (!session) {
        return CHAT_SESSION_EMPTY;
    }
    return session;
}
