import path from "node:path";
import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";

import type { ToolDefinition, ToolResultContract } from "@/types";
import type { AcpSessions } from "../../acp/acpSessions.js";
import type { AcpPermissionMode } from "../../acp/acpSessionTypes.js";
import { resolveWorkspacePath } from "../../permissions.js";

const schema = Type.Object(
    {
        description: Type.String({ minLength: 1 }),
        command: Type.String({ minLength: 1 }),
        args: Type.Optional(Type.Array(Type.String())),
        cwd: Type.Optional(Type.String({ minLength: 1 })),
        env: Type.Optional(Type.Record(Type.String(), Type.String())),
        permissionMode: Type.Optional(Type.Union([Type.Literal("allow"), Type.Literal("deny")]))
    },
    { additionalProperties: false }
);

type AcpSessionStartArgs = Static<typeof schema>;

const resultSchema = Type.Object(
    {
        summary: Type.String(),
        sessionId: Type.String(),
        remoteSessionId: Type.String(),
        description: Type.String(),
        command: Type.String(),
        cwd: Type.String()
    },
    { additionalProperties: false }
);

type AcpSessionStartResult = Static<typeof resultSchema>;

const returns: ToolResultContract<AcpSessionStartResult> = {
    schema: resultSchema,
    toLLMText: (result) => result.summary
};

/**
 * Builds the acp_session_start tool to launch an external ACP adapter session.
 * Expects: command is installed and cwd stays inside the caller workspace.
 */
export function acpSessionStartToolBuild(
    acpSessions: AcpSessions
): ToolDefinition<typeof schema, AcpSessionStartResult> {
    return {
        tool: {
            name: "acp_session_start",
            description:
                "Launch an ACP adapter subprocess such as codex-acp or claude-agent-acp and create a new ACP session.",
            parameters: schema
        },
        returns,
        execute: async (args, toolContext, toolCall) => {
            const payload = args as AcpSessionStartArgs;
            const workingDir = toolContext.sandbox.workingDir;
            if (!workingDir) {
                throw new Error("Workspace is not configured.");
            }

            const description = payload.description.trim();
            const command = payload.command.trim();
            if (!description) {
                throw new Error("description is required.");
            }
            if (!command) {
                throw new Error("command is required.");
            }

            const cwd = cwdResolve(workingDir, payload.cwd);
            const permissionMode = (payload.permissionMode ?? "allow") as AcpPermissionMode;
            const session = await acpSessions.create({
                ctx: toolContext.ctx,
                ownerAgentId: toolContext.agent.id,
                ownerAgentName: toolContext.agent.config.name?.trim() || null,
                description,
                command,
                args: payload.args ?? [],
                cwd,
                env: payload.env,
                permissionMode
            });
            const summary = `ACP session started: ${session.id} (${description}) in ${session.cwd}.`;
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
                    sessionId: session.id,
                    remoteSessionId: session.remoteSessionId,
                    description: session.description,
                    command: session.command,
                    cwd: session.cwd
                }
            };
        }
    };
}

function cwdResolve(workingDir: string, cwd: string | undefined): string {
    if (!cwd) {
        return workingDir;
    }
    const normalized = cwd.trim();
    if (!normalized) {
        return workingDir;
    }
    if (path.isAbsolute(normalized)) {
        return resolveWorkspacePath(workingDir, path.relative(workingDir, normalized));
    }
    return resolveWorkspacePath(workingDir, normalized);
}
