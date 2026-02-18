import { Type } from "@sinclair/typebox";
import type { Static } from "@sinclair/typebox";
import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { createId } from "@paralleldrive/cuid2";
import path from "node:path";

import type { ToolDefinition, ToolResultContract } from "@/types";
import type {
  PermissionAccess,
  PermissionDecision,
  PermissionEntry,
  PermissionRequest,
  PermissionRequestScope
} from "@/types";
import { agentDescriptorTargetResolve } from "../../agents/ops/agentDescriptorTargetResolve.js";
import { agentDescriptorLabel } from "../../agents/ops/agentDescriptorLabel.js";
import { permissionAccessParse } from "../../permissions/permissionAccessParse.js";
import { permissionAccessAllows } from "../../permissions/permissionAccessAllows.js";
import { permissionDescribeDecision } from "../../permissions/permissionDescribeDecision.js";

const schema = Type.Object(
  {
    permissions: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
    reason: Type.String({ minLength: 1 }),
    agentId: Type.Optional(Type.String({ minLength: 1 })),
    scope: Type.Optional(Type.Union([Type.Literal("now"), Type.Literal("always")])),
    timeout_minutes: Type.Optional(Type.Integer({ minimum: 1, maximum: 60, default: 15 }))
  },
  { additionalProperties: false }
);

type PermissionArgs = Static<typeof schema>;

const grantSchema = Type.Object(
  {
    agentId: Type.String({ minLength: 1 }),
    permission: Type.String({ minLength: 1 }),
    reason: Type.String({ minLength: 1 })
  },
  { additionalProperties: false }
);

type PermissionGrantArgs = Static<typeof grantSchema>;

const permissionToolResultSchema = Type.Object(
  {
    summary: Type.String(),
    approved: Type.Boolean(),
    agentId: Type.String(),
    permissionCount: Type.Number(),
    scope: Type.Optional(Type.String()),
    token: Type.Optional(Type.String()),
    timedOut: Type.Optional(Type.Boolean())
  },
  { additionalProperties: false }
);

type PermissionToolResult = Static<typeof permissionToolResultSchema>;

const permissionToolReturns: ToolResultContract<PermissionToolResult> = {
  schema: permissionToolResultSchema,
  toLLMText: (result) => result.summary
};

export function buildPermissionRequestTool(): ToolDefinition<typeof schema, PermissionToolResult> {
  return {
    tool: {
      name: "request_permission",
      description:
        "Request additional permissions from the user. App agents may set scope='always' to persist grants for future runs.",
      parameters: schema
    },
    returns: permissionToolReturns,
    execute: async (args, toolContext, toolCall) => {
      const payload = args as PermissionArgs;
      const descriptor = toolContext.agent.descriptor;
      const isForeground = descriptor.type === "user";
      const permissionTags = permissionTagsNormalize(payload.permissions);
      const reason = payload.reason.trim();
      const requestedScope = payload.scope ?? "now";
      const timeoutMinutes = payload.timeout_minutes ?? 15;
      if (!reason) {
        throw new Error("Permission reason is required.");
      }
      if (permissionTags.length === 0) {
        throw new Error("At least one permission string is required.");
      }
      if (payload.scope && descriptor.type !== "app") {
        throw new Error("Permission scope is only supported for app agents.");
      }
      if (!isForeground && payload.agentId) {
        throw new Error("Background agents cannot override agentId.");
      }
      const requestedAgentId = payload.agentId?.trim() ?? toolContext.agent.id;
      const requestedDescriptor =
        requestedAgentId === toolContext.agent.id
          ? descriptor
          : toolContext.agentSystem.getAgentDescriptor(requestedAgentId);
      if (!requestedDescriptor) {
        throw new Error("Requested agent not found.");
      }

      const connectorRegistry = toolContext.connectorRegistry;
      if (!connectorRegistry) {
        throw new Error("Connector registry unavailable.");
      }
      const permissionRequestRegistry = toolContext.permissionRequestRegistry;
      if (!permissionRequestRegistry) {
        throw new Error("Permission request registry unavailable.");
      }

      const foregroundAgentId = isForeground
        ? toolContext.agent.id
        : toolContext.agentSystem.agentFor("most-recent-foreground");
      if (!foregroundAgentId) {
        throw new Error("No foreground agent available for permission requests.");
      }
      const foregroundDescriptor = isForeground
        ? descriptor
        : toolContext.agentSystem.getAgentDescriptor(foregroundAgentId);
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

      const requestedPermissions = permissionTags.map((permission) => {
        const access = permissionAccessParse(permission);
        if ((access.kind === "read" || access.kind === "write") && !path.isAbsolute(access.path)) {
          throw new Error("Path must be absolute.");
        }
        return { permission, access };
      });
      const targetPermissions = await toolContext.agentSystem.permissionsForTarget({
        agentId: requestedAgentId
      });
      const missingPermissions: PermissionEntry[] = [];
      for (const requestedPermission of requestedPermissions) {
        const hasPermission = await permissionAccessAllows(
          targetPermissions,
          requestedPermission.access
        );
        if (!hasPermission) {
          missingPermissions.push(requestedPermission);
        }
      }

      if (missingPermissions.length === 0) {
        const permissionLabel = permissionSummaryBuild(requestedPermissions);
        const permissionNoun = requestedPermissions.length === 1 ? "Permission" : "Permissions";
        const toolMessage: ToolResultMessage = {
          role: "toolResult",
          toolCallId: toolCall.id,
          toolName: toolCall.name,
          content: [{ type: "text", text: `${permissionNoun} already granted for ${permissionLabel}.` }],
          details: {
            permissions: permissionTags,
            agentId: requestedAgentId,
            approved: true
          },
          isError: false,
          timestamp: Date.now()
        };
        return {
          toolMessage,
          typedResult: {
            summary: `${permissionNoun} already granted for ${permissionLabel}.`,
            approved: true,
            agentId: requestedAgentId,
            permissionCount: permissionTags.length
          }
        };
      }

      const permissionsToRequest = missingPermissions;
      const missingPermissionTags = new Set(missingPermissions.map((entry) => entry.permission));
      const friendly = permissionsToRequest
        .map((entry) => `- ${describePermission(entry.access)}`)
        .join("\n");
      const requesterLabel = agentDescriptorLabel(requestedDescriptor);
      const requesterKind =
        requestedDescriptor.type === "user" ? "foreground" : "background";
      const heading =
        requestedDescriptor.type === "user"
          ? "Permission request:"
          : requestedDescriptor.type === "app"
            ? `Permission request from app "${requesterLabel}":`
            : `Permission request from background agent "${requesterLabel}":`;
      const scopeLine =
        descriptor.type === "app"
          ? `Scope: ${permissionScopeLabel(requestedScope)}`
          : null;
      const text = [
        heading,
        friendly,
        `Reason: ${reason}`,
        scopeLine
      ]
        .filter((line): line is string => Boolean(line))
        .join("\n");
      const request: PermissionRequest = {
        token: createId(),
        agentId: requestedAgentId,
        reason,
        message: text,
        permissions: permissionsToRequest,
        ...(descriptor.type === "app" ? { scope: requestedScope } : {}),
        requester: {
          id: requestedAgentId,
          type: requestedDescriptor.type,
          label: requesterLabel,
          kind: requesterKind
        }
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

      if (!isForeground && requestedDescriptor.type !== "user") {
        const agentName = agentDescriptorLabel(requestedDescriptor);
        const requestedPermissionLines = permissionsToRequest
          .map((entry) => `- ${entry.permission}`)
          .join("\n");
        const notice = [
          `Permission request from background agent "${agentName}" was presented to the user.`,
          "permissions:",
          requestedPermissionLines,
          `reason: ${reason}`
        ].join("\n");
        await toolContext.agentSystem.post(
          { agentId: foregroundAgentId },
          {
            type: "system_message",
            text: notice,
            origin: requestedAgentId,
            silent: true
          }
        );
      }

      let decision: PermissionDecision;
      try {
        decision = await permissionRequestRegistry.register(
          request.token,
          timeoutMinutes * 60_000
        );
      } catch (error) {
        const isTimeout =
          error instanceof Error && error.message === "Permission request timed out.";
        if (!isTimeout) {
          throw error;
        }
        const timeoutText = `Permission request timed out after ${timeoutMinutes} minute${timeoutMinutes === 1 ? "" : "s"}.`;
        const toolMessage: ToolResultMessage = {
          role: "toolResult",
          toolCallId: toolCall.id,
          toolName: toolCall.name,
          content: [{ type: "text", text: timeoutText }],
          details: {
            permissions: permissionTags,
            token: request.token,
            agentId: requestedAgentId,
            timeoutMinutes
          },
          isError: true,
          timestamp: Date.now()
        };
        return {
          toolMessage,
          typedResult: {
            summary: timeoutText,
            approved: false,
            agentId: requestedAgentId,
            permissionCount: permissionTags.length,
            token: request.token,
            timedOut: true
          }
        };
      }

      const targetAgentId = decision.agentId || requestedAgentId;
      const resolvedScope: PermissionRequestScope =
        descriptor.type === "app" && (decision.scope === "always" || requestedScope === "always")
          ? "always"
          : "now";
      if (decision.approved) {
        for (const permission of decision.permissions) {
          if (!missingPermissionTags.has(permission.permission)) {
            continue;
          }
          if (descriptor.type === "app" && resolvedScope === "always") {
            await toolContext.agentSystem.grantAppPermission(
              descriptor.appId,
              permission.access,
              {
                source: toolContext.source,
                decision: { ...decision, scope: "always" }
              }
            );
            continue;
          }
          await toolContext.agentSystem.grantPermission({ agentId: targetAgentId }, permission.access, {
            source: toolContext.source,
            decision
          });
        }
      }

      const permissionLabel = permissionSummaryBuild(decision.permissions);
      const permissionNoun = decision.permissions.length === 1 ? "Permission" : "Permissions";
      const resultText = decision.approved
        ? `${permissionNoun} granted for ${permissionLabel}.`
        : `${permissionNoun} denied for ${permissionLabel}.`;
      const scopedResultText =
        descriptor.type === "app"
          ? `${resultText} Scope: ${permissionScopeLabel(resolvedScope)}.`
          : resultText;

      const toolMessage: ToolResultMessage = {
        role: "toolResult",
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        content: [{ type: "text", text: scopedResultText }],
        details: {
          permissions: permissionTags,
          token: request.token,
          agentId: targetAgentId,
          approved: decision.approved,
          ...(descriptor.type === "app" ? { scope: resolvedScope } : {})
        },
        isError: false,
        timestamp: Date.now()
      };

      return {
        toolMessage,
        typedResult: {
          summary: scopedResultText,
          approved: decision.approved,
          agentId: targetAgentId,
          permissionCount: decision.permissions.length,
          ...(descriptor.type === "app" ? { scope: resolvedScope } : {}),
          token: request.token
        }
      };
    }
  };
}

export function buildPermissionGrantTool(): ToolDefinition<typeof grantSchema, PermissionToolResult> {
  return {
    tool: {
      name: "grant_permission",
      description:
        "Grant a permission you already have to another agent (requires a justification).",
      parameters: grantSchema
    },
    returns: permissionToolReturns,
    execute: async (args, toolContext, toolCall) => {
      const payload = args as PermissionGrantArgs;
      const permission = payload.permission.trim();
      const reason = payload.reason.trim();
      if (!reason) {
        throw new Error("Reason is required.");
      }

      const access = permissionAccessParse(permission);
      const allowed = await permissionAccessAllows(toolContext.permissions, access);
      if (!allowed) {
        throw new Error("You can only grant permissions you already have.");
      }

      await toolContext.agentSystem.grantPermission(
        { agentId: payload.agentId },
        access
      );

      const summary = `Permission granted to agent ${payload.agentId}.`;
      const toolMessage: ToolResultMessage = {
        role: "toolResult",
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        content: [
          {
            type: "text",
            text: summary
          }
        ],
        details: {
          agentId: payload.agentId,
          permission,
          reason
        },
        isError: false,
        timestamp: Date.now()
      };

      return {
        toolMessage,
        typedResult: {
          summary,
          approved: true,
          agentId: payload.agentId,
          permissionCount: 1
        }
      };
    }
  };
}

function describePermission(access: PermissionAccess): string {
  if (access.kind === "network") {
    return "Network access";
  }
  if (access.kind === "events") {
    return "Events access (Daycare socket control)";
  }
  if (access.kind === "workspace") {
    return "Workspace write access";
  }
  if (access.kind === "read") {
    return `Read access to ${access.path}`;
  }
  return `Write access to ${access.path}`;
}

function permissionSummaryBuild(permissions: PermissionEntry[]): string {
  const labels = permissions.map((permission) => permissionDescribeDecision(permission.access));
  if (labels.length === 0) {
    return "requested permissions";
  }
  return labels.join(", ");
}

function permissionTagsNormalize(permissions: string[]): string[] {
  const unique = new Set<string>();
  for (const permission of permissions) {
    const trimmed = permission.trim();
    if (trimmed) {
      unique.add(trimmed);
    }
  }
  return [...unique];
}

function permissionScopeLabel(scope: PermissionRequestScope): string {
  return scope === "always"
    ? "Always (all future runs for this app)"
    : "One time (this app run only)";
}
