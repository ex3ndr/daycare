import type { AssistantMessage, Context } from "@mariozechner/pi-ai";

import type {
    ConnectorMessage,
    FileReference,
    MessageContext,
    MessageContextEnrichment,
    SessionPermissions,
    Signal
} from "@/types";
import type { TaskParameter } from "../../modules/tasks/taskParameterTypes.js";
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
    /**
     * Token accounting source:
     * - usage: provider-reported usage from inference response
     * - estimate: local heuristic fallback
     */
    source?: "usage" | "estimate";
    size: AgentTokenSnapshotSize;
};

export type AgentAssistantContent = AssistantMessage["content"];

export type AgentTokenStats = Record<string, Record<string, AgentTokenSize>>;

export type AgentModelOverride = { type: "selector"; value: string };

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
    /** Checkpoint snapshot id (cuid2), resolved to a file under the agent folder. */
    snapshotId: string;
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
    reason: "run_python_failure_trim";
};

export type AgentHistoryRecord =
    | {
          type: "user_message";
          at: number;
          text: string;
          files: FileReference[];
          enrichments?: MessageContextEnrichment[];
          /** Set when a first-message prompt was prepended to the user's text. */
          firstMessagePrepended?: boolean;
          /** The prompt text that was prepended, for reconstruction of original message. */
          firstMessagePrompt?: string;
      }
    | {
          type: "assistant_message";
          at: number;
          content: AgentAssistantContent;
          tokens: AgentTokenEntry | null;
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
          code?: string;
          /** Optional DB-backed task reference; when provided, the agent resolves code from tasks storage. */
          task?: { id: string; version?: number };
          /** Optional task id attached for cross-trigger execution tracking. */
          taskId?: string;
          /** Input variables injected natively into Monty VM for executable system messages. */
          inputs?: Record<string, unknown> | null;
          /** Parameter schema for executable system message input variable type annotations. */
          inputSchemas?: TaskParameter[] | null;
          context?: MessageContext;
          /** When true, return code execution output directly without LLM inference. */
          sync?: boolean;
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
          responseError?: boolean;
          executionErrorText?: string;
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
