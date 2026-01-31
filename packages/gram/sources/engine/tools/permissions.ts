import { Type } from "@sinclair/typebox";
import type { Static } from "@sinclair/typebox";
import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { createId } from "@paralleldrive/cuid2";
import path from "node:path";

import type { ToolDefinition } from "./types.js";
import type { PermissionKind, PermissionRequest } from "../connectors/types.js";

const schema = Type.Object(
  {
    kind: Type.Union([Type.Literal("read"), Type.Literal("write"), Type.Literal("web")]),
    path: Type.Optional(Type.String({ minLength: 1 })),
    reason: Type.String({ minLength: 1 })
  },
  { additionalProperties: false }
);

type PermissionArgs = Static<typeof schema>;

export function buildPermissionRequestTool(): ToolDefinition {
  return {
    tool: {
      name: "request_permission",
      description:
        "Request additional permissions from the user. Emits a connector-specific approval prompt.",
      parameters: schema
    },
    execute: async (args, toolContext, toolCall) => {
      const payload = args as PermissionArgs;
      const connectorRegistry = toolContext.connectorRegistry;
      if (!connectorRegistry) {
        throw new Error("Connector registry unavailable.");
      }

      const connector = connectorRegistry.get(toolContext.source);
      if (!connector) {
        throw new Error("Connector not available for permission requests.");
      }

      if (payload.kind !== "web" && !payload.path) {
        throw new Error("Path is required for read/write permissions.");
      }
      if (payload.kind === "web" && payload.path) {
        throw new Error("Path is not allowed for web permissions.");
      }
      if (payload.path && !path.isAbsolute(payload.path)) {
        throw new Error("Path must be absolute.");
      }

      const permission = formatPermission(payload.kind, payload.path);
      const text = `${payload.reason}\n${permission}`;
      const request: PermissionRequest = {
        token: createId(),
        kind: payload.kind as PermissionKind,
        path: payload.path,
        reason: payload.reason,
        message: text,
        permission
      };

      if (connector.requestPermission) {
        await connector.requestPermission(
          toolContext.messageContext.channelId,
          request,
          toolContext.messageContext
        );
      } else {
        await connector.sendMessage(toolContext.messageContext.channelId, {
          text,
          replyToMessageId: toolContext.messageContext.messageId
        });
      }

      const toolMessage: ToolResultMessage = {
        role: "toolResult",
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        content: [{ type: "text", text: "Permission request sent." }],
        details: {
          permission,
          token: request.token
        },
        isError: false,
        timestamp: Date.now()
      };

      return { toolMessage };
    }
  };
}

function formatPermission(kind: PermissionKind, path?: string): string {
  if (kind === "web") {
    return "@web";
  }
  const target = path?.trim();
  if (!target) {
    return `@${kind}:`;
  }
  return `@${kind}:${target}`;
}
