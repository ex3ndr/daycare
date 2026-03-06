/**
 * Client-side types for agent history records.
 * Mirrors the backend AgentHistoryRecord discriminated union from
 * packages/daycare/sources/engine/agents/ops/agentTypes.ts
 */

export type AgentHistoryUserMessage = {
    type: "user_message";
    at: number;
    text: string;
};

export type AgentHistoryAssistantMessage = {
    type: "assistant_message";
    at: number;
    content: AgentAssistantContentBlock[];
};

export type AgentAssistantContentBlock =
    | { type: "text"; text: string }
    | { type: "tool_use"; id: string; name: string; input: unknown };

export type AgentHistoryRlmToolCall = {
    type: "rlm_tool_call";
    at: number;
    toolName: string;
    toolCallCount: number;
};

export type AgentHistoryRlmStart = {
    type: "rlm_start";
    at: number;
    description?: string;
};

export type AgentHistoryNote = {
    type: "note";
    at: number;
    text: string;
};

/** Record types we skip rendering. */
export type AgentHistorySkipped =
    | { type: "rlm_complete"; at: number }
    | { type: "rlm_tool_result"; at: number }
    | { type: "assistant_rewrite"; at: number };

export type AgentHistoryRecord =
    | AgentHistoryUserMessage
    | AgentHistoryAssistantMessage
    | AgentHistoryRlmStart
    | AgentHistoryRlmToolCall
    | AgentHistoryNote
    | AgentHistorySkipped;
