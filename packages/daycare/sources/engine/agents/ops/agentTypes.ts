import type { Context, ToolCall } from "@mariozechner/pi-ai";

import type {
    ConnectorMessage,
    FileReference,
    MessageContext,
    SessionPermissions,
    Signal,
    ToolExecutionResult
} from "@/types";
import type { AgentDescriptor } from "./agentDescriptorTypes.js";

export type AgentMessage = {
    id: string;
    message: ConnectorMessage;
    context: MessageContext;
    receivedAt: number;
};

export type AgentTokenSize = {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    total: number;
};

export type AgentTokenSnapshotSize = AgentTokenSize;

export type AgentTokenEntry = {
    provider: string;
    model: string;
    size: AgentTokenSnapshotSize;
};

export type AgentTokenStats = Record<string, Record<string, AgentTokenSize>>;

export type AgentModelOverride =
    | { type: "selector"; value: "small" | "normal" | "big" }
    | { type: "model"; value: string };

export type AgentState = {
    context: Context;
    activeSessionId?: string | null;
    inferenceSessionId?: string;
    permissions: SessionPermissions;
    tokens: AgentTokenEntry | null;
    stats: AgentTokenStats;
    createdAt: number;
    updatedAt: number;
    state: AgentLifecycleState;
    modelOverride?: AgentModelOverride | null;
};

export type AgentLifecycleState = "active" | "sleeping" | "dead";

export type AgentHistoryRlmStartRecord = {
    type: "rlm_start";
    at: number;
    toolCallId: string;
    code: string;
    preamble: string;
};

export type AgentHistoryRlmToolCallRecord = {
    type: "rlm_tool_call";
    at: number;
    toolCallId: string;
    snapshot: string;
    printOutput: string[];
    toolCallCount: number;
    toolName: string;
    toolArgs: unknown;
};

export type AgentHistoryRlmToolResultRecord = {
    type: "rlm_tool_result";
    at: number;
    toolCallId: string;
    toolName: string;
    toolResult: string;
    toolIsError: boolean;
};

export type AgentHistoryRlmCompleteRecord = {
    type: "rlm_complete";
    at: number;
    toolCallId: string;
    output: string;
    printOutput: string[];
    toolCallCount: number;
    isError: boolean;
    error?: string;
};

export type AgentHistoryAssistantRewriteRecord = {
    type: "assistant_rewrite";
    at: number;
    assistantAt: number;
    text: string;
    reason: "run_python_say_after_trim" | "run_python_failure_trim";
};

export type AgentHistoryRecord =
    | {
          type: "user_message";
          at: number;
          text: string;
          files: FileReference[];
          /** Set when a first-message prompt was prepended to the user's text. */
          firstMessagePrepended?: boolean;
          /** The prompt text that was prepended, for reconstruction of original message. */
          firstMessagePrompt?: string;
      }
    | {
          type: "assistant_message";
          at: number;
          text: string;
          files: FileReference[];
          toolCalls: ToolCall[];
          tokens: AgentTokenEntry | null;
      }
    | {
          type: "tool_result";
          at: number;
          toolCallId: string;
          output: ToolExecutionResult;
      }
    | AgentHistoryRlmStartRecord
    | AgentHistoryRlmToolCallRecord
    | AgentHistoryRlmToolResultRecord
    | AgentHistoryRlmCompleteRecord
    | AgentHistoryAssistantRewriteRecord
    | { type: "note"; at: number; text: string };

export type AgentInboxItem =
    | {
          type: "message";
          message: ConnectorMessage;
          context: MessageContext;
      }
    | {
          type: "system_message";
          text: string;
          origin?: string;
          silent?: boolean;
          execute?: boolean;
          code?: string[];
          context?: MessageContext;
      }
    | {
          type: "signal";
          signal: Signal;
          subscriptionPattern: string;
      }
    | {
          type: "reset";
          message?: string;
          context?: MessageContext;
      }
    | {
          type: "compact";
          context?: MessageContext;
      }
    | {
          type: "restore";
      };

export type AgentInboxMessage = Extract<AgentInboxItem, { type: "message" }>;
export type AgentInboxSystemMessage = Extract<AgentInboxItem, { type: "system_message" }>;
export type AgentInboxSignal = Extract<AgentInboxItem, { type: "signal" }>;

export type AgentInboxReset = Extract<AgentInboxItem, { type: "reset" }>;
export type AgentInboxCompact = Extract<AgentInboxItem, { type: "compact" }>;
export type AgentInboxRestore = Extract<AgentInboxItem, { type: "restore" }>;

export type AgentInboxSteering = {
    type: "steering";
    text: string;
    origin?: string;
    cancelReason?: string; // Error message for cancelled tool calls
};

export type AgentInboxResult =
    | {
          type: "message";
          responseText: string | null;
      }
    | {
          type: "system_message";
          responseText: string | null;
      }
    | {
          type: "signal";
          delivered: boolean;
          responseText: string | null;
      }
    | {
          type: "reset";
          ok: boolean;
      }
    | {
          type: "compact";
          ok: boolean;
      }
    | {
          type: "restore";
          ok: boolean;
      };

export type AgentInboxCompletion = {
    resolve: (result: AgentInboxResult) => void;
    reject: (error: Error) => void;
};

export type AgentInboxEntry = {
    id: string;
    postedAt: number;
    item: AgentInboxItem;
    completion: AgentInboxCompletion | null;
};

export type AgentPostTarget = { agentId: string } | { descriptor: AgentDescriptor };

export type BackgroundAgentState = {
    agentId: string;
    name: string | null;
    parentAgentId: string | null;
    lifecycle: AgentLifecycleState;
    status: "running" | "queued" | "idle";
    pending: number;
    updatedAt: number;
};
