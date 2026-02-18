import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { toolExecutionResultText, toolReturnText } from "./toolReturnText.js";
import { Type, type Static } from "@sinclair/typebox";

import type { ToolDefinition } from "@/types";
import type { Signal } from "@/types";
import type { Signals } from "../../signals/signals.js";

const schema = Type.Object(
  {
    fromAt: Type.Optional(Type.Integer({ minimum: 0 })),
    toAt: Type.Optional(Type.Integer({ minimum: 0 })),
    types: Type.Optional(Type.Array(Type.String({ minLength: 1 }), { minItems: 1, maxItems: 100 }))
  },
  { additionalProperties: false }
);

type SignalEventsCsvArgs = Static<typeof schema>;
type SignalEventsCsvTimeRange = {
  fromAt: number | null;
  toAt: number | null;
};

/**
 * Builds the signal_events_csv tool for CSV-friendly event inspection.
 * Expects: filters are optional; when both fromAt/toAt are provided, fromAt <= toAt.
 */
export function signalEventsCsvToolBuild(signals: Signals): ToolDefinition {
  return {
    tool: {
      name: "signal_events_csv",
      description:
        "Read signal events as CSV. Optional filters: fromAt/toAt (unix ms) and types (exact event type matches). Columns: event_type,args,unix_time,ai_friendly_time.",
      parameters: schema
    },
    returns: toolReturnText,
    execute: async (args, _toolContext, toolCall) => {
      const payload = args as SignalEventsCsvArgs;
      const timeRange = signalEventsCsvTimeRangeNormalize(payload.fromAt, payload.toAt);
      const types = signalTypesNormalize(payload.types);
      const records = signalEventsFilter(await signals.listAll(), timeRange, types);
      const text = signalEventsCsvBuild(records);

      const toolMessage: ToolResultMessage = {
        role: "toolResult",
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        content: [{ type: "text", text }],
        details: {
          fromAt: timeRange.fromAt,
          toAt: timeRange.toAt,
          types,
          recordCount: records.length
        },
        isError: false,
        timestamp: Date.now()
      };
      return toolExecutionResultText(toolMessage);
    }
  };
}

function signalEventsCsvTimeRangeNormalize(
  fromAt: number | undefined,
  toAt: number | undefined
): SignalEventsCsvTimeRange {
  const normalized: SignalEventsCsvTimeRange = {
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

function signalTypesNormalize(types: string[] | undefined): string[] {
  if (!types || types.length === 0) {
    return [];
  }
  const normalized = types
    .map((type) => type.trim())
    .filter((type) => type.length > 0);
  return Array.from(new Set(normalized));
}

function signalEventsFilter(
  records: Signal[],
  timeRange: SignalEventsCsvTimeRange,
  types: string[]
): Signal[] {
  const typeSet = new Set(types);
  return records.filter((record) => {
    if (timeRange.fromAt !== null && record.createdAt < timeRange.fromAt) {
      return false;
    }
    if (timeRange.toAt !== null && record.createdAt > timeRange.toAt) {
      return false;
    }
    if (typeSet.size > 0 && !typeSet.has(record.type)) {
      return false;
    }
    return true;
  });
}

function signalEventsCsvBuild(records: Signal[]): string {
  const header = "event_type,args,unix_time,ai_friendly_time";
  if (records.length === 0) {
    return header;
  }
  const lines = records.map((record) => {
    const args = JSON.stringify(record.data ?? null);
    const aiFriendlyTime = new Date(record.createdAt).toISOString();
    return [
      csvEscape(record.type),
      csvEscape(args),
      csvEscape(String(record.createdAt)),
      csvEscape(aiFriendlyTime)
    ].join(",");
  });
  return [header, ...lines].join("\n");
}

function csvEscape(value: string): string {
  if (!/[",\n]/.test(value)) {
    return value;
  }
  return `"${value.replace(/"/g, "\"\"")}"`;
}
