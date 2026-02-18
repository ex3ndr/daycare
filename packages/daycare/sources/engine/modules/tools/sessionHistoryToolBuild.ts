import { createId } from "@paralleldrive/cuid2";
import { toolExecutionResultText, toolReturnText } from "./toolReturnText.js";
import type { Context } from "@mariozechner/pi-ai";
import { Type, type Static } from "@sinclair/typebox";
import type { ToolResultMessage } from "@mariozechner/pi-ai";

import type {
  AgentHistoryRecord,
  ToolDefinition,
  ToolExecutionContext
} from "@/types";
import { listActiveInferenceProviders, getProviderDefinition } from "../../../providers/catalog.js";
import { providerModelSelectBySize } from "../../../providers/providerModelSelectBySize.js";
import { stringTruncate } from "../../../utils/stringTruncate.js";
import { agentDescriptorRead } from "../../agents/ops/agentDescriptorRead.js";
import { agentHistoryLoad } from "../../agents/ops/agentHistoryLoad.js";
import { agentHistorySummary } from "../../agents/ops/agentHistorySummary.js";
import { agentPromptBundledRead } from "../../agents/ops/agentPromptBundledRead.js";
import { messageExtractText } from "../../messages/messageExtractText.js";
import { toolResultFormatVerbose } from "./toolResultFormatVerbose.js";

const schema = Type.Object(
  {
    agentId: Type.String({ minLength: 1 }),
    summarized: Type.Optional(Type.Boolean()),
    fromAt: Type.Optional(Type.Integer({ minimum: 0 })),
    toAt: Type.Optional(Type.Integer({ minimum: 0 }))
  },
  { additionalProperties: false }
);

type SessionHistoryArgs = Static<typeof schema>;
type SessionHistoryTimeRange = {
  fromAt: number | null;
  toAt: number | null;
};

const MAX_SUMMARY_RECORDS = 400;
const MAX_SUMMARY_INPUT_CHARS = 120_000;

/**
 * Builds the read_session_history tool for cross-session visibility.
 * Expects: agentId references another persisted agent/session id.
 */
export function sessionHistoryToolBuild(): ToolDefinition {
  return {
    tool: {
      name: "read_session_history",
      description:
        "Read another session's history by agentId. Returns a summary by default (summarized=true). Optional fromAt/toAt filters by record timestamp (unix ms).",
      parameters: schema
    },
    returns: toolReturnText,
    execute: async (args, toolContext, toolCall) => {
      const payload = args as SessionHistoryArgs;
      const agentId = payload.agentId.trim();
      if (!agentId) {
        throw new Error("agentId is required.");
      }
      if (agentId === toolContext.agent.id) {
        throw new Error("agentId must refer to another session.");
      }

      const config = toolContext.agentSystem.config.current;
      const descriptor = await agentDescriptorRead(config, agentId);
      if (!descriptor) {
        throw new Error(`Agent session not found: ${agentId}`);
      }

      const timeRange = sessionHistoryTimeRangeNormalize(payload.fromAt, payload.toAt);
      const records = agentHistoryFilterByTime(
        await agentHistoryLoad(config, agentId),
        timeRange
      );
      const summarized = payload.summarized ?? true;
      const text = summarized
        ? await summaryTextGenerate(agentId, records, toolContext)
        : rawHistoryTextBuild(agentId, records);

      const toolMessage: ToolResultMessage = {
        role: "toolResult",
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        content: [{ type: "text", text }],
        details: {
          agentId,
          summarized,
          recordCount: records.length,
          fromAt: timeRange.fromAt,
          toAt: timeRange.toAt
        },
        isError: false,
        timestamp: Date.now()
      };

      return toolExecutionResultText(toolMessage);
    }
  };
}

async function summaryTextGenerate(
  agentId: string,
  records: AgentHistoryRecord[],
  toolContext: ToolExecutionContext
): Promise<string> {
  if (records.length === 0) {
    return `No history records found for agent ${agentId}.`;
  }
  const providers = listActiveInferenceProviders(
    toolContext.agentSystem.config.current.settings
  );
  if (providers.length === 0) {
    throw new Error("No inference provider available.");
  }
  const providersOverride = providers.map((provider) => {
    const definition = getProviderDefinition(provider.id);
    const normalModel = providerModelSelectBySize(definition?.models ?? [], "normal");
    return normalModel ? { ...provider, model: normalModel } : { ...provider };
  });

  const summaryPrompt = (await agentPromptBundledRead("COMPACTION.md")).trim();
  const summaryContext: Context = {
    systemPrompt: summaryPrompt,
    messages: [
      {
        role: "user",
        content: summaryInputBuild(agentId, records),
        timestamp: Date.now()
      }
    ]
  };

  const response = await toolContext.agentSystem.inferenceRouter.complete(
    summaryContext,
    `session-history-summary:${createId()}`,
    { providersOverride }
  );
  const summaryText = messageExtractText(response.message)?.trim();
  if (!summaryText) {
    throw new Error("Summarization model returned empty output.");
  }
  return [`Agent ${agentId} session summary:`, summaryText].join("\n");
}

function rawHistoryTextBuild(agentId: string, records: AgentHistoryRecord[]): string {
  if (records.length === 0) {
    return `No history records found for agent ${agentId}.`;
  }
  return [
    `Agent ${agentId} full session history (${records.length} records):`,
    JSON.stringify(records, null, 2)
  ].join("\n");
}

function summaryInputBuild(agentId: string, records: AgentHistoryRecord[]): string {
  const summary = agentHistorySummary(records);
  const tail = records.slice(-MAX_SUMMARY_RECORDS);
  const omittedCount = records.length - tail.length;
  const lines = [
    `Summarize this agent session history: ${agentId}`,
    `record_count: ${summary.recordCount}`,
    `range: ${formatTimestamp(summary.firstAt)} -> ${formatTimestamp(summary.lastAt)}`,
    [
      `types: start=${summary.counts.start}`,
      `reset=${summary.counts.reset}`,
      `user=${summary.counts.user_message}`,
      `assistant=${summary.counts.assistant_message}`,
      `assistant_rewrite=${summary.counts.assistant_rewrite}`,
      `tool_result=${summary.counts.tool_result}`,
      `note=${summary.counts.note}`
    ].join(" "),
    omittedCount > 0
      ? `Only last ${tail.length} records are included below (${omittedCount} earlier records omitted).`
      : "All records are included below.",
    "History:"
  ];

  for (const record of tail) {
    lines.push(recordSummaryLineBuild(record));
  }
  return stringTruncate(lines.join("\n"), MAX_SUMMARY_INPUT_CHARS);
}

function sessionHistoryTimeRangeNormalize(
  fromAt: number | undefined,
  toAt: number | undefined
): SessionHistoryTimeRange {
  const normalized: SessionHistoryTimeRange = {
    fromAt: fromAt ?? null,
    toAt: toAt ?? null
  };
  if (
    normalized.fromAt !== null &&
    normalized.toAt !== null &&
    normalized.fromAt > normalized.toAt
  ) {
    throw new Error("fromAt must be less than or equal to toAt.");
  }
  return normalized;
}

function agentHistoryFilterByTime(
  records: AgentHistoryRecord[],
  timeRange: SessionHistoryTimeRange
): AgentHistoryRecord[] {
  return records.filter((record) => {
    if (timeRange.fromAt !== null && record.at < timeRange.fromAt) {
      return false;
    }
    if (timeRange.toAt !== null && record.at > timeRange.toAt) {
      return false;
    }
    return true;
  });
}

function recordSummaryLineBuild(record: AgentHistoryRecord): string {
  const prefix = `[${formatTimestamp(record.at)}]`;
  if (record.type === "start") {
    return `${prefix} start`;
  }
  if (record.type === "reset") {
    return `${prefix} reset ${record.message ? `message="${singleLine(record.message)}"` : ""}`.trim();
  }
  if (record.type === "user_message") {
    return `${prefix} user_message text="${singleLine(stringTruncate(record.text, 700))}"`;
  }
  if (record.type === "assistant_message") {
    return `${prefix} assistant_message text="${singleLine(stringTruncate(record.text, 700))}"`;
  }
  if (record.type === "assistant_rewrite") {
    return `${prefix} assistant_rewrite assistantAt=${record.assistantAt} reason=${record.reason} text="${singleLine(stringTruncate(record.text, 700))}"`;
  }
  if (record.type === "note") {
    return `${prefix} note text="${singleLine(stringTruncate(record.text, 400))}"`;
  }
  if (record.type === "rlm_start") {
    return `${prefix} rlm_start toolCallId=${record.toolCallId} code="${singleLine(stringTruncate(record.code, 400))}"`;
  }
  if (record.type === "rlm_tool_call") {
    return `${prefix} rlm_tool_call toolCallId=${record.toolCallId} toolName=${record.toolName}`;
  }
  if (record.type === "rlm_tool_result") {
    return `${prefix} rlm_tool_result toolCallId=${record.toolCallId} toolName=${record.toolName} isError=${record.toolIsError}`;
  }
  if (record.type === "rlm_complete") {
    return `${prefix} rlm_complete toolCallId=${record.toolCallId} isError=${record.isError} toolCalls=${record.toolCallCount}`;
  }
  return `${prefix} tool_result toolCallId=${record.toolCallId} ${singleLine(toolResultFormatVerbose(record.output))}`;
}

function singleLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function formatTimestamp(at: number | null): string {
  if (at === null) {
    return "unknown";
  }
  return new Date(at).toISOString();
}
