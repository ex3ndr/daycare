import { Type } from "@sinclair/typebox";
import type { ToolResultMessage } from "@mariozechner/pi-ai";

import type { ToolDefinition } from "@/types";

const schema = Type.Object(
  {
    summary: Type.String({ minLength: 1 }),
    persist: Type.Array(Type.String({ minLength: 1 }), { minItems: 0 })
  },
  { additionalProperties: false }
);

type CompactArgs = {
  summary: string;
  persist: string[];
};

/**
 * Accepts a compaction summary for resetting the session context.
 * Expects: summary is non-empty; persist items are plain strings.
 */
export function compactToolBuild(): ToolDefinition<typeof schema> {
  return {
    tool: {
      name: "compact",
      description: "Persist a compaction summary and reset the active session context.",
      parameters: schema
    },
    execute: async (args, _context, toolCall) => {
      const payload = args as CompactArgs;
      const summary = payload.summary.trim();
      if (!summary) {
        throw new Error("Compaction summary is required.");
      }
      const persist = payload.persist.map((item) => item.trim()).filter((item) => item.length > 0);

      const toolMessage: ToolResultMessage = {
        role: "toolResult",
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        content: [
          {
            type: "text",
            text: "Compaction summary captured."
          }
        ],
        details: {
          summary,
          persist
        },
        isError: false,
        timestamp: Date.now()
      };

      return {
        toolMessage,
        files: []
      };
    }
  };
}
