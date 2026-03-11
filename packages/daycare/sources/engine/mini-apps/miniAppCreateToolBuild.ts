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
        id: Type.String({ minLength: 1 }),
        title: Type.String({ minLength: 1 }),
        icon: Type.String({ minLength: 1 }),
        html: Type.String({ minLength: 1 }),
        files: Type.Optional(Type.Array(fileSchema))
    },
    { additionalProperties: false }
);

type MiniAppCreateToolArgs = Static<typeof schema>;

const resultSchema = Type.Object(
    {
        summary: Type.String(),
        appId: Type.String(),
        title: Type.String(),
        icon: Type.String(),
        version: Type.Number(),
        codeVersion: Type.Number()
    },
    { additionalProperties: false }
);

type MiniAppCreateToolResult = Static<typeof resultSchema>;

const returns: ToolResultContract<MiniAppCreateToolResult> = {
    schema: resultSchema,
    toLLMText: (result) => result.summary
};

/**
 * Builds the mini_app_create tool for versioned static mini apps.
 * Expects: id is stable and html is a complete SPA entry document.
 */
export function miniAppCreateToolBuild(miniApps: MiniApps): ToolDefinition {
    return {
        tool: {
            name: "mini_app_create",
            description: "Create a versioned static mini app with an index.html entrypoint and related assets.",
            parameters: schema
        },
        returns,
        visibleByDefault: (context) => context.config.foreground === true,
        execute: async (args, toolContext, toolCall) => {
            const payload = args as MiniAppCreateToolArgs;
            const created = await miniApps.create(toolContext.ctx, payload);
            const summary = `Mini app created: ${created.title} (${created.id}) v${created.version} code ${created.codeVersion}.`;
            const toolMessage: ToolResultMessage = {
                role: "toolResult",
                toolCallId: toolCall.id,
                toolName: toolCall.name,
                content: [{ type: "text", text: summary }],
                details: {
                    miniAppId: created.id,
                    miniAppVersion: created.version,
                    miniAppCodeVersion: created.codeVersion
                },
                isError: false,
                timestamp: Date.now()
            };
            return {
                toolMessage,
                typedResult: {
                    summary,
                    appId: created.id,
                    title: created.title,
                    icon: created.icon,
                    version: created.version,
                    codeVersion: created.codeVersion
                }
            };
        }
    };
}
