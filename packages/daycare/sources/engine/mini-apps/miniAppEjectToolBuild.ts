import { promises as fs } from "node:fs";
import path from "node:path";
import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";
import type { ToolDefinition, ToolResultContract } from "@/types";
import type { MiniApps } from "./MiniApps.js";

const schema = Type.Object(
    {
        appId: Type.String({ minLength: 1 }),
        path: Type.String({ minLength: 1 })
    },
    { additionalProperties: false }
);

type MiniAppEjectToolArgs = Static<typeof schema>;

const resultSchema = Type.Object(
    {
        summary: Type.String(),
        appId: Type.String(),
        status: Type.String()
    },
    { additionalProperties: false }
);

type MiniAppEjectToolResult = Static<typeof resultSchema>;

const returns: ToolResultContract<MiniAppEjectToolResult> = {
    schema: resultSchema,
    toLLMText: (result) => result.summary
};

/**
 * Builds the mini_app_eject tool for copying the current app version into the sandbox.
 * Expects: path is writable under the caller sandbox permissions.
 */
export function miniAppEjectToolBuild(miniApps: MiniApps): ToolDefinition {
    return {
        tool: {
            name: "mini_app_eject",
            description: "Copy the current mini-app files to a writable sandbox path.",
            parameters: schema
        },
        returns,
        visibleByDefault: (context) => context.config.foreground === true,
        execute: async (args, toolContext, toolCall) => {
            const payload = args as MiniAppEjectToolArgs;
            const sourceDir = await miniApps.versionDirectory(toolContext.ctx, payload.appId);
            if (!sourceDir) {
                throw new Error(`Mini app not found: ${payload.appId}`);
            }

            const destinationHostPath = await destinationHostPathResolve(payload.path, toolContext.sandbox);
            const targetDir = path.join(destinationHostPath, path.basename(sourceDir));
            await fs.rm(targetDir, { recursive: true, force: true });
            await fs.mkdir(destinationHostPath, { recursive: true });
            await fs.cp(sourceDir, targetDir, { recursive: true });

            const summary = `Mini app "${payload.appId}" ejected to ${payload.path}.`;
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
                    appId: payload.appId.trim(),
                    status: "ejected"
                }
            };
        }
    };
}

async function destinationHostPathResolve(
    destinationPath: string,
    sandbox: {
        workingDir: string;
        write: (input: { path: string; content: string; exclusive: boolean }) => Promise<{ resolvedPath: string }>;
    }
): Promise<string> {
    const destinationSandboxPath =
        path.isAbsolute(destinationPath) || destinationPath.startsWith("~")
            ? destinationPath
            : path.resolve(sandbox.workingDir, destinationPath);
    const markerName = `.daycare-mini-app-eject-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const markerSandboxPath = destinationSandboxPath.startsWith("~")
        ? path.posix.join(destinationSandboxPath, markerName)
        : path.resolve(destinationSandboxPath, markerName);
    const marker = await sandbox.write({
        path: markerSandboxPath,
        content: "",
        exclusive: true
    });
    await fs.rm(marker.resolvedPath, { force: true });
    return path.dirname(marker.resolvedPath);
}
