import { type ChatSessionView, chatSessionSelect } from "./chatSessionSelect";
import { chatStoreCreate } from "./chatStoreCreate";

export const useChatStore = chatStoreCreate();

/**
 * Selects display state for a single chat session.
 * Expects: agentId is the active session key or null during initialization.
 */
export function useChat(agentId: string | null): ChatSessionView {
    return useChatStore((state) => chatSessionSelect(state.sessions, agentId));
}
