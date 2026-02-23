import path from "node:path";

import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";

import type { ToolDefinition, ToolExecutionContext, ToolResultContract } from "@/types";
import { appInstall } from "./appInstall.js";
import type { Apps } from "./appManager.js";

const schema = Type.Object(
    {
        source: Type.String({ minLength: 1 })
    },
    { additionalProperties: false }
);

type AppInstallArgs = Static<typeof schema>;

const appInstallResultSchema = Type.Object(
    {
        summary: Type.String(),
        appId: Type.String(),
        source: Type.String()
    },
    { additionalProperties: false }
);

type AppInstallResult = Static<typeof appInstallResultSchema>;

const appInstallReturns: ToolResultContract<AppInstallResult> = {
    schema: appInstallResultSchema,
    toLLMText: (result) => result.summary
};

/**
 * Builds the install_app tool for filesystem-based app installation.
 * Expects: source points to a directory containing APP.md and PERMISSIONS.md.
 */
export function appInstallToolBuild(apps: Apps): ToolDefinition {
    return {
        tool: {
            name: "install_app",
            description: "Install an app from a local directory containing APP.md and PERMISSIONS.md.",
            parameters: schema
        },
        returns: appInstallReturns,
        execute: async (args, context, toolCall) => {
            const payload = args as AppInstallArgs;
            const source = payload.source.trim();
            if (!source) {
                throw new Error("source is required.");
            }
            const resolvedSource = path.isAbsolute(source)
                ? path.resolve(source)
                : path.resolve(context.permissions.workingDir, source);
            const userId = contextUserIdResolve(context);
            const appsDir = context.agentSystem.userHomeForUserId(userId).apps;

            const descriptor = await appInstall(appsDir, resolvedSource);
            await apps.discover();
            apps.registerTools(context.agentSystem.toolResolver);

            const summary = `Installed app "${descriptor.id}" from ${resolvedSource}.`;
            const toolMessage: ToolResultMessage = {
                role: "toolResult",
                toolCallId: toolCall.id,
                toolName: toolCall.name,
                content: [{ type: "text", text: summary }],
                isError: false,
                timestamp: Date.now()
            };
            return {
                toolMessage,
                typedResult: {
                    summary,
                    appId: descriptor.id,
                    source: resolvedSource
                }
            };
        }
    };
}

function contextUserIdResolve(context: ToolExecutionContext): string {
    const contextWithOptionalCtx = context as unknown as { ctx?: { userId?: string } | null };
    const userId = contextWithOptionalCtx.ctx?.userId;
    if (typeof userId !== "string" || userId.trim().length === 0) {
        throw new Error("Tool context userId is required.");
    }
    return userId.trim();
}
