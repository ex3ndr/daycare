import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";
import type { ToolDefinition, ToolResultContract } from "@/types";
import type { MiniApps } from "./MiniApps.js";

const fileSchema = Type.Object(
    {
        path: Type.String({ minLength: 1 }),
        content: Type.String(),
        encoding: Type.Optional(Type.Union([Type.Literal("utf8"), Type.Literal("base64")]))
    },
    { additionalProperties: false }
);

const schema = Type.Object(
    {
        appId: Type.String({ minLength: 1 }),
        title: Type.Optional(Type.String({ minLength: 1 })),
        icon: Type.Optional(Type.String({ minLength: 1 })),
        html: Type.Optional(Type.String({ minLength: 1 })),
        files: Type.Optional(Type.Array(fileSchema)),
        deletePaths: Type.Optional(Type.Array(Type.String({ minLength: 1 })))
    },
    { additionalProperties: false }
);

type MiniAppUpdateToolArgs = Static<typeof schema>;

const resultSchema = Type.Object(
    {
        summary: Type.String(),
        appId: Type.String(),
        title: Type.String(),
        icon: Type.String(),
        version: Type.Number()
    },
    { additionalProperties: false }
);

type MiniAppUpdateToolResult = Static<typeof resultSchema>;

const returns: ToolResultContract<MiniAppUpdateToolResult> = {
    schema: resultSchema,
    toLLMText: (result) => result.summary
};

/**
 * Builds the mini_app_update tool for versioning new static-site revisions.
 * Expects: appId references an existing mini app.
 */
export function miniAppUpdateToolBuild(miniApps: MiniApps): ToolDefinition {
    return {
        tool: {
            name: "mini_app_update",
            description: "Create a new mini-app version by updating index.html, assets, title, or icon.",
            parameters: schema
        },
        returns,
        visibleByDefault: (context) => context.config.foreground === true,
        execute: async (args, toolContext, toolCall) => {
            const payload = args as MiniAppUpdateToolArgs;
            const updated = await miniApps.update(toolContext.ctx, payload.appId, payload);
            const summary = `Mini app updated: ${updated.title} (${updated.id}) v${updated.version}.`;
            const toolMessage: ToolResultMessage = {
                role: "toolResult",
                toolCallId: toolCall.id,
                toolName: toolCall.name,
                content: [{ type: "text", text: summary }],
                details: {
                    miniAppId: updated.id,
                    miniAppVersion: updated.version
                },
                isError: false,
                timestamp: Date.now()
            };
            return {
                toolMessage,
                typedResult: {
                    summary,
                    appId: updated.id,
                    title: updated.title,
                    icon: updated.icon,
                    version: updated.version
                }
            };
        }
    };
}
