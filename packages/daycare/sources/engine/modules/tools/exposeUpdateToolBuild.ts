import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { Type, type Static } from "@sinclair/typebox";

import type { ToolDefinition, ToolResultContract } from "@/types";
import type { Exposes } from "../../expose/exposes.js";

const schema = Type.Object(
  {
    endpointId: Type.String({ minLength: 1 }),
    authenticated: Type.Boolean()
  },
  { additionalProperties: false }
);

type ExposeUpdateArgs = Static<typeof schema>;

const exposeUpdateResultSchema = Type.Object(
  {
    summary: Type.String(),
    endpointId: Type.String(),
    domain: Type.String(),
    authenticated: Type.Boolean()
  },
  { additionalProperties: false }
);

type ExposeUpdateResult = Static<typeof exposeUpdateResultSchema>;

const exposeUpdateReturns: ToolResultContract<ExposeUpdateResult> = {
  schema: exposeUpdateResultSchema,
  toLLMText: (result) => result.summary
};

/**
 * Builds the expose_update tool for toggling endpoint authentication.
 * Expects: endpointId references an existing endpoint.
 */
export function exposeUpdateToolBuild(
  exposes: Pick<Exposes, "update">
): ToolDefinition {
  return {
    tool: {
      name: "expose_update",
      description:
        "Update expose endpoint authentication; enabling auth returns a new password.",
      parameters: schema
    },
    returns: exposeUpdateReturns,
    execute: async (args, _toolContext, toolCall) => {
      const payload = args as ExposeUpdateArgs;
      const endpointId = payload.endpointId.trim();
      if (!endpointId) {
        throw new Error("endpointId is required.");
      }

      const updated = await exposes.update(endpointId, {
        authenticated: payload.authenticated
      });

      const authText = updated.password
        ? `Auth enabled. Username: daycare Password: ${updated.password}`
        : `Auth ${updated.endpoint.auth ? "enabled" : "disabled"}.`;
      const summary = [
        `Expose endpoint updated: ${updated.endpoint.id}`,
        `Domain: ${updated.endpoint.domain}`,
        authText
      ].join("\n");

      const toolMessage: ToolResultMessage = {
        role: "toolResult",
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        content: [{ type: "text", text: summary }],
        details: {
          endpoint: updated.endpoint,
          password: updated.password
        },
        isError: false,
        timestamp: Date.now()
      };

      return {
        toolMessage,
        typedResult: {
          summary,
          endpointId: updated.endpoint.id,
          domain: updated.endpoint.domain,
          authenticated: Boolean(updated.endpoint.auth)
        }
      };
    }
  };
}
