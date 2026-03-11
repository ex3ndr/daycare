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

type MiniAppDeleteToolArgs = Static<typeof schema>;

const resultSchema = Type.Object(
    {
        summary: Type.String(),
        appId: Type.String(),
        status: Type.String()
    },
    { additionalProperties: false }
);

type MiniAppDeleteToolResult = Static<typeof resultSchema>;

const returns: ToolResultContract<MiniAppDeleteToolResult> = {
    schema: resultSchema,
    toLLMText: (result) => result.summary
};

/**
 * Builds the mini_app_delete tool for removing the active mini-app version from the sidebar.
 * Expects: appId references an existing mini app.
 */
export function miniAppDeleteToolBuild(miniApps: MiniApps): ToolDefinition {
    return {
        tool: {
            name: "mini_app_delete",
            description: "Delete a mini app and remove its sidebar tab.",
            parameters: schema
        },
        returns,
        visibleByDefault: (context) => context.config.foreground === true,
        execute: async (args, toolContext, toolCall) => {
            const payload = args as MiniAppDeleteToolArgs;
            const deleted = await miniApps.delete(toolContext.ctx, payload.appId);
            const summary = `Mini app deleted: ${deleted.title} (${deleted.id}).`;
            const toolMessage: ToolResultMessage = {
                role: "toolResult",
                toolCallId: toolCall.id,
                toolName: toolCall.name,
                content: [{ type: "text", text: summary }],
                details: {
                    miniAppId: deleted.id
                },
                isError: false,
                timestamp: Date.now()
            };
            return {
                toolMessage,
                typedResult: {
                    summary,
                    appId: deleted.id,
                    status: "deleted"
                }
            };
        }
    };
}
