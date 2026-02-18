import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { toolMessageTextExtract } from "../modules/tools/toolReturnOutcome.js";
import { Type, type Static } from "@sinclair/typebox";
import path from "node:path";

import type { ToolDefinition, ToolResultContract } from "@/types";
import type { Apps } from "./appManager.js";
import { appRuleApply, type AppRuleAction } from "./appRuleApply.js";

const schema = Type.Object(
  {
    app_id: Type.String({ minLength: 1 }),
    action: Type.Union([
      Type.Literal("add_deny"),
      Type.Literal("add_allow"),
      Type.Literal("remove_deny"),
      Type.Literal("remove_allow")
    ]),
    rule: Type.String({ minLength: 1 })
  },
  { additionalProperties: false }
);

type AppRuleArgs = Static<typeof schema>;

const appRuleResultSchema = Type.Object(
  {
    summary: Type.String(),
    appId: Type.String(),
    action: Type.String(),
    changed: Type.Boolean(),
    approved: Type.Boolean()
  },
  { additionalProperties: false }
);

type AppRuleResult = Static<typeof appRuleResultSchema>;

const appRuleReturns: ToolResultContract<AppRuleResult> = {
  schema: appRuleResultSchema,
  toLLMText: (result) => result.summary
};

/**
 * Builds the app_rules tool for mutable app allow/deny policies.
 * Expects: target app id exists in the app manager index.
 */
export function appRuleToolBuild(apps: Apps): ToolDefinition {
  return {
    tool: {
      name: "app_rules",
      description: "Manage app allow/deny rules. All mutations require permission approval.",
      parameters: schema
    },
    returns: appRuleReturns,
    execute: async (args, context, toolCall) => {
      const payload = args as AppRuleArgs;
      const appId = payload.app_id.trim();
      if (!appId) {
        throw new Error("app_id is required.");
      }

      let descriptor = apps.get(appId);
      if (!descriptor) {
        await apps.discover();
        descriptor = apps.get(appId);
      }
      if (!descriptor) {
        throw new Error(`Unknown app: ${appId}`);
      }

      const permissionsPath = path.join(path.resolve(descriptor.path), "PERMISSIONS.md");
      const permissionResult = await context.agentSystem.toolResolver.execute(
        {
          id: `${toolCall.id}:permission`,
          name: "request_permission",
          type: "toolCall",
          arguments: {
            permissions: [`@write:${permissionsPath}`],
            reason: appRulePermissionReasonBuild(payload.action, payload.rule)
          }
        },
        context
      );
      const approved = permissionApprovedRead(permissionResult.toolMessage.details);
      if (permissionResult.toolMessage.isError || !approved) {
        return {
          toolMessage: permissionResult.toolMessage,
          typedResult: {
            summary: toolMessageTextExtract(permissionResult.toolMessage),
            appId,
            action: payload.action,
            changed: false,
            approved: false
          }
        };
      }

      const result = await appRuleApply({
        appDir: descriptor.path,
        action: payload.action as AppRuleAction,
        rule: payload.rule,
        addedBy: context.agent.id
      });

      if (result.changed) {
        await apps.discover();
        apps.registerTools(context.agentSystem.toolResolver);
      }

      const toolMessage: ToolResultMessage = {
        role: "toolResult",
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        content: [{ type: "text", text: result.message }],
        details: {
          appId,
          action: payload.action,
          changed: result.changed
        },
        isError: false,
        timestamp: Date.now()
      };
      return {
        toolMessage,
        typedResult: {
          summary: result.message,
          appId,
          action: payload.action,
          changed: result.changed,
          approved: true
        }
      };
    }
  };
}

function appRulePermissionReasonBuild(action: AppRuleAction, rule: string): string {
  const normalizedRule = rule.trim();
  const actionLabel =
    action === "add_allow"
      ? "add allow rule"
      : action === "add_deny"
        ? "add deny rule"
        : action === "remove_allow"
          ? "remove allow rule"
          : "remove deny rule";
  return `Confirm app policy change (${actionLabel}): ${normalizedRule}`;
}

function permissionApprovedRead(details: unknown): boolean {
  if (typeof details !== "object" || details === null) {
    return false;
  }
  const approved = (details as { approved?: unknown }).approved;
  return approved === true;
}
