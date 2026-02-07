import { Type } from "@sinclair/typebox";
import type { ToolResultMessage } from "@mariozechner/pi-ai";

import type { ToolDefinition } from "@/types";
import { agentBackgroundList } from "../../agents/ops/agentBackgroundList.js";

const schema = Type.Object({}, { additionalProperties: false });

/**
 * Builds the list_background_agents tool for non-user agent visibility.
 * Expects: background agent descriptors + state are persisted on disk.
 */
export function agentBackgroundListToolBuild(): ToolDefinition {
  return {
    tool: {
      name: "list_background_agents",
      description:
        "List persisted background agents with ids, names, lifecycle, queue status, and parent linkage.",
      parameters: schema
    },
    execute: async (_args, toolContext, toolCall) => {
      const agents = (await agentBackgroundList(toolContext.agentSystem.config.current))
        .sort((left, right) => right.updatedAt - left.updatedAt);

      const text = agents.length === 0
        ? "No background agents found."
        : [
            `Found ${agents.length} background agent(s):`,
            ...agents.map((agent) => {
              const name = agent.name ?? "unknown";
              const parent = agent.parentAgentId ? ` parentAgentId=${agent.parentAgentId}` : "";
              return `${agent.agentId} name=${name}${parent} lifecycle=${agent.lifecycle} status=${agent.status} pending=${agent.pending}`;
            })
          ].join("\n");

      const toolMessage: ToolResultMessage = {
        role: "toolResult",
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        content: [{ type: "text", text }],
        details: {
          count: agents.length,
          agents
        },
        isError: false,
        timestamp: Date.now()
      };

      return { toolMessage, files: [] };
    }
  };
}
