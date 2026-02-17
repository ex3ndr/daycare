import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { Type, type Static } from "@sinclair/typebox";

import type { ToolDefinition } from "@/types";
import type { Exposes } from "../../expose/exposes.js";

const schema = Type.Object(
  {
    endpointId: Type.String({ minLength: 1 })
  },
  { additionalProperties: false }
);

type ExposeRemoveArgs = Static<typeof schema>;

/**
 * Builds the expose_remove tool for deleting expose endpoints.
 * Expects: endpointId references an existing endpoint.
 */
export function exposeRemoveToolBuild(
  exposes: Pick<Exposes, "remove">
): ToolDefinition {
  return {
    tool: {
      name: "expose_remove",
      description: "Remove an expose endpoint and tear down its tunnel.",
      parameters: schema
    },
    execute: async (args, _toolContext, toolCall) => {
      const payload = args as ExposeRemoveArgs;
      const endpointId = payload.endpointId.trim();
      if (!endpointId) {
        throw new Error("endpointId is required.");
      }

      await exposes.remove(endpointId);

      const toolMessage: ToolResultMessage = {
        role: "toolResult",
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        content: [{ type: "text", text: `Expose endpoint removed: ${endpointId}` }],
        details: { endpointId },
        isError: false,
        timestamp: Date.now()
      };

      return { toolMessage };
    }
  };
}
