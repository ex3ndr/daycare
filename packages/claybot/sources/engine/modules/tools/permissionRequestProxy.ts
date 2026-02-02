import { Type } from "@sinclair/typebox";
import type { Static } from "@sinclair/typebox";
import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { createId } from "@paralleldrive/cuid2";
import path from "node:path";

import type { ToolDefinition } from "@/types";
import type { PermissionAccess, PermissionRequest } from "@/types";
import { agentDescriptorTargetResolve } from "../../agents/ops/agentDescriptorTargetResolve.js";

const schema = Type.Object(
  {
    permission: Type.String({ minLength: 1 }),
    reason: Type.String({ minLength: 1 })
  },
  { additionalProperties: false }
);

type PermissionProxyArgs = Static<typeof schema>;

/**
 * Builds the permission request proxy tool for background agents.
 * This tool allows background agents to request permissions via a foreground agent.
 * Expects: background agent context with an active foreground target.
 */
export function buildPermissionRequestProxyTool(): ToolDefinition {
  return {
    tool: {
      name: "request_permission_via_parent",
      description:
        "Request additional permissions via the foreground agent. Use this when you need read, write, or web access that was not pre-approved.",
      parameters: schema
    },
    execute: async (args, toolContext, toolCall) => {
      const payload = args as PermissionProxyArgs;
      const connectorRegistry = toolContext.connectorRegistry;
      if (!connectorRegistry) {
        throw new Error("Connector registry unavailable.");
      }

      const descriptor = toolContext.agent.descriptor;
      if (descriptor.type === "user") {
        throw new Error("Use request_permission for foreground agents.");
      }

      // Always proxy via the most recent foreground agent.
      const foregroundAgentId = toolContext.agentSystem.agentFor("most-recent-foreground");
      if (!foregroundAgentId) {
        throw new Error("No foreground agent available to proxy permission request.");
      }

      const foregroundDescriptor = toolContext.agentSystem.getAgentDescriptor(foregroundAgentId);
      if (!foregroundDescriptor) {
        throw new Error("Foreground agent descriptor not found.");
      }

      const target = agentDescriptorTargetResolve(foregroundDescriptor);
      if (!target) {
        throw new Error("Foreground agent has no user target for permission requests.");
      }

      const connector = connectorRegistry.get(target.connector);
      if (!connector) {
        throw new Error("Connector not available for permission requests.");
      }

      const access = parsePermission(payload.permission);
      if (access.kind !== "web" && !path.isAbsolute(access.path)) {
        throw new Error("Path must be absolute.");
      }

      const permission = payload.permission.trim();
      const friendly = describePermission(access);
      const agentName = descriptor.type === "subagent" ? descriptor.name : descriptor.type;
      const text = `Permission request from background agent "${agentName}":\n${friendly}\nReason: ${payload.reason}`;
      const token = createId();

      const request: PermissionRequest = {
        token,
        agentId: toolContext.agent.id,
        reason: payload.reason,
        message: text,
        permission,
        access
      };

      if (connector.requestPermission) {
        await connector.requestPermission(
          target.targetId,
          request,
          toolContext.messageContext,
          foregroundDescriptor
        );
      } else {
        await connector.sendMessage(target.targetId, {
          text,
          replyToMessageId: toolContext.messageContext.messageId
        });
      }

      const toolMessage: ToolResultMessage = {
        role: "toolResult",
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        content: [{ type: "text", text: "Permission request sent via foreground agent." }],
        details: {
          permission,
          token,
          foregroundAgentId
        },
        isError: false,
        timestamp: Date.now()
      };

      return { toolMessage, files: [] };
    }
  };
}

function parsePermission(value: string): PermissionAccess {
  const trimmed = value.trim();
  if (trimmed === "@web") {
    return { kind: "web" };
  }
  if (trimmed.startsWith("@read:")) {
    const pathValue = trimmed.slice("@read:".length).trim();
    if (!pathValue) {
      throw new Error("Read permission requires a path.");
    }
    return { kind: "read", path: pathValue };
  }
  if (trimmed.startsWith("@write:")) {
    const pathValue = trimmed.slice("@write:".length).trim();
    if (!pathValue) {
      throw new Error("Write permission requires a path.");
    }
    return { kind: "write", path: pathValue };
  }
  throw new Error("Permission must be @web, @read:<path>, or @write:<path>.");
}

function describePermission(access: PermissionAccess): string {
  if (access.kind === "web") {
    return "Web access";
  }
  if (access.kind === "read") {
    return `Read access to ${access.path}`;
  }
  return `Write access to ${access.path}`;
}
