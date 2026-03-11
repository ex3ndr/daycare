import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";
import type { ToolDefinition, ToolResultContract } from "@/types";
import type { MiniApps } from "./MiniApps.js";

const schema = Type.Object(
    {
        appId: Type.String({ minLength: 1 })
    },
    { additionalProperties: false }
);

type MiniAppRestoreToolArgs = Static<typeof schema>;

const resultSchema = Type.Object(
    {
        summary: Type.String(),
        appId: Type.String(),
        status: Type.String()
    },
    { additionalProperties: false }
);

type MiniAppRestoreToolResult = Static<typeof resultSchema>;

const returns: ToolResultContract<MiniAppRestoreToolResult> = {
    schema: resultSchema,
    toLLMText: (result) => result.summary
};

/**
 * Builds the mini_app_restore tool for restoring a deleted mini-app.
 * Expects: appId references a deleted mini app.
 */
export function miniAppRestoreToolBuild(miniApps: MiniApps): ToolDefinition {
    return {
        tool: {
            name: "mini_app_restore",
            description: "Restore a deleted mini app and bring back its sidebar tab.",
            parameters: schema
        },
        returns,
        visibleByDefault: (context) => context.config.foreground === true,
        execute: async (args, toolContext, toolCall) => {
            const payload = args as MiniAppRestoreToolArgs;
            const restored = await miniApps.restore(toolContext.ctx, payload.appId);
            const summary = `Mini app restored: ${restored.title} (${restored.id}).`;
            const toolMessage: ToolResultMessage = {
                role: "toolResult",
                toolCallId: toolCall.id,
                toolName: toolCall.name,
                content: [{ type: "text", text: summary }],
                details: {
                    miniAppId: restored.id
                },
                isError: false,
                timestamp: Date.now()
            };
            return {
                toolMessage,
                typedResult: {
                    summary,
                    appId: restored.id,
                    status: "restored"
                }
            };
        }
    };
}
