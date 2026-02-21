import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";
import type { ToolDefinition, ToolResultContract } from "@/types";
import { appDiscover } from "./appDiscover.js";
import type { Apps } from "./appManager.js";
import { type AppRuleAction, appRuleApply } from "./appRuleApply.js";

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
            description: "Manage app allow/deny rules.",
            parameters: schema
        },
        returns: appRuleReturns,
        execute: async (args, context, toolCall) => {
            const payload = args as AppRuleArgs;
            const appId = payload.app_id.trim();
            if (!appId) {
                throw new Error("app_id is required.");
            }

            const appsDir = context.agentSystem.userHomeForUserId(context.ctx.userId).apps;
            const descriptor = (await appDiscover(appsDir)).find((entry) => entry.id === appId) ?? null;
            if (!descriptor) {
                throw new Error(`Unknown app: ${appId}`);
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
