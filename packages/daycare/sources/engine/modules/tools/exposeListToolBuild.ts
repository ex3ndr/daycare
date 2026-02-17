import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";

import type { ToolDefinition } from "@/types";
import type { Exposes } from "../../expose/exposes.js";

const schema = Type.Object({}, { additionalProperties: false });

/**
 * Builds the expose_list tool for listing active expose endpoints.
 * Expects: expose module is started.
 */
export function exposeListToolBuild(
  exposes: Pick<Exposes, "list" | "listProviders">
): ToolDefinition {
  return {
    tool: {
      name: "expose_list",
      description: "List all expose endpoints and available providers.",
      parameters: schema
    },
    execute: async (_args, _toolContext, toolCall) => {
      const [endpoints, providers] = await Promise.all([
        exposes.list(),
        Promise.resolve(exposes.listProviders())
      ]);

      const text = [
        `Expose endpoints: ${endpoints.length}`,
        ...endpoints.map((endpoint) => {
          const target = endpoint.target.type === "port"
            ? `port:${endpoint.target.port}`
            : `unix:${endpoint.target.path}`;
          return `${endpoint.id} domain=${endpoint.domain} target=${target} provider=${endpoint.provider} mode=${endpoint.mode} authenticated=${Boolean(endpoint.auth)}`;
        }),
        `Providers: ${providers.length}`,
        ...providers.map((provider) =>
          `${provider.instanceId} domain=${provider.domain} public=${provider.capabilities.public} localNetwork=${provider.capabilities.localNetwork}`
        )
      ].join("\n");

      const toolMessage: ToolResultMessage = {
        role: "toolResult",
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        content: [{ type: "text", text }],
        details: {
          endpoints,
          providers
        },
        isError: false,
        timestamp: Date.now()
      };

      return { toolMessage };
    }
  };
}
