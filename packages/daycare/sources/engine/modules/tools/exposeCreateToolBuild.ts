import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { Type, type Static } from "@sinclair/typebox";

import type { ExposeMode, ExposeTarget, ToolDefinition, ToolResultContract } from "@/types";
import type { Exposes } from "../../expose/exposes.js";

const schema = Type.Object(
  {
    port: Type.Optional(Type.Number({ minimum: 1, maximum: 65535 })),
    unixSocket: Type.Optional(Type.String({ minLength: 1 })),
    provider: Type.Optional(Type.String({ minLength: 1 })),
    mode: Type.Optional(Type.Union([Type.Literal("public"), Type.Literal("local-network")])),
    authenticated: Type.Optional(Type.Boolean())
  },
  { additionalProperties: false }
);

type ExposeCreateArgs = Static<typeof schema>;

const exposeCreateResultSchema = Type.Object(
  {
    summary: Type.String(),
    endpointId: Type.String(),
    domain: Type.String(),
    provider: Type.String(),
    mode: Type.String(),
    authenticated: Type.Boolean()
  },
  { additionalProperties: false }
);

type ExposeCreateResult = Static<typeof exposeCreateResultSchema>;

const exposeCreateReturns: ToolResultContract<ExposeCreateResult> = {
  schema: exposeCreateResultSchema,
  toLLMText: (result) => result.summary
};

/**
 * Builds the expose_create tool for creating public or LAN endpoints.
 * Expects: exactly one target input is provided (port or unixSocket).
 */
export function exposeCreateToolBuild(
  exposes: Pick<Exposes, "create">
): ToolDefinition {
  return {
    tool: {
      name: "expose_create",
      description:
        "Expose a local HTTP port or unix socket through a tunnel provider.",
      parameters: schema
    },
    returns: exposeCreateReturns,
    execute: async (args, _toolContext, toolCall) => {
      const payload = args as ExposeCreateArgs;
      const target = targetResolve(payload);
      const mode = (payload.mode ?? "public") as ExposeMode;
      const authenticated = payload.authenticated ?? false;
      const created = await exposes.create({
        target,
        provider: payload.provider,
        mode,
        authenticated
      });

      const authText = created.password
        ? `Auth enabled. Username: daycare Password: ${created.password}`
        : "Auth disabled.";
      const summary = [
        `Expose endpoint created: ${created.endpoint.id}`,
        `Domain: ${created.endpoint.domain}`,
        `Provider: ${created.endpoint.provider}`,
        `Mode: ${created.endpoint.mode}`,
        `Target: ${targetTextBuild(created.endpoint.target)}`,
        authText
      ].join("\n");

      const toolMessage: ToolResultMessage = {
        role: "toolResult",
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        content: [{ type: "text", text: summary }],
        details: {
          endpoint: created.endpoint,
          password: created.password
        },
        isError: false,
        timestamp: Date.now()
      };

      return {
        toolMessage,
        typedResult: {
          summary,
          endpointId: created.endpoint.id,
          domain: created.endpoint.domain,
          provider: created.endpoint.provider,
          mode: created.endpoint.mode,
          authenticated: Boolean(created.endpoint.auth)
        }
      };
    }
  };
}

function targetResolve(payload: ExposeCreateArgs): ExposeTarget {
  const hasPort = typeof payload.port === "number";
  const hasUnixSocket =
    typeof payload.unixSocket === "string" && payload.unixSocket.trim().length > 0;

  if (hasPort === hasUnixSocket) {
    throw new Error("Provide exactly one of `port` or `unixSocket`.");
  }

  if (hasPort) {
    return { type: "port", port: payload.port as number };
  }

  return { type: "unix", path: (payload.unixSocket as string).trim() };
}

function targetTextBuild(target: ExposeTarget): string {
  if (target.type === "port") {
    return `port:${target.port}`;
  }
  return `unix:${target.path}`;
}
