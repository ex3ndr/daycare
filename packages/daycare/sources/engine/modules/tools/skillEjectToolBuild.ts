import { promises as fs } from "node:fs";
import path from "node:path";
import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";
import type { ToolDefinition, ToolResultContract } from "@/types";
import { skillVersionSourceResolve } from "../../skills/skillVersionSourceResolve.js";
import type { ToolExecutionContext } from "./types.js";

const schema = Type.Object(
    {
        name: Type.String({ minLength: 1 }),
        path: Type.String({ minLength: 1 }),
        version: Type.Optional(Type.Integer({ minimum: 1 }))
    },
    { additionalProperties: false }
);

type SkillEjectArgs = Static<typeof schema>;

const resultSchema = Type.Object(
    {
        summary: Type.String(),
        skillName: Type.String(),
        status: Type.String(),
        version: Type.Integer({ minimum: 1 })
    },
    { additionalProperties: false }
);

type SkillEjectResult = Static<typeof resultSchema>;

const returns: ToolResultContract<SkillEjectResult> = {
    schema: resultSchema,
    toLLMText: (result) => result.summary
};

/**
 * Copies a current or archived personal skill version to a destination sandbox path.
 * Expects: name matches a personal skill frontmatter name and path is writable in sandbox permissions.
 */
export function skillEjectToolBuild(): ToolDefinition {
    return {
        tool: {
            name: "skill_eject",
            description: "Copy a personal skill folder to a writable sandbox path.",
            parameters: schema
        },
        returns,
        visibleByDefault: (context) => context.config.foreground === true,
        execute: async (args, toolContext, toolCall) => {
            const payload = args as SkillEjectArgs;
            const personalRoot = toolContext.skillsPersonalRoot;
            if (!personalRoot) {
                throw new Error("Personal skills directory is not configured.");
            }

            const requestedName = payload.name.trim();
            if (!requestedName) {
                throw new Error("Skill name is required.");
            }
            const destinationPath = payload.path.trim();
            if (!destinationPath) {
                throw new Error("Destination path is required.");
            }

            const historyRoot = toolContext.agentSystem.userHomeForUserId(toolContext.ctx.userId).skillsHistory;
            const matched = await skillVersionSourceResolve({
                personalRoot,
                historyRoot,
                skillName: requestedName,
                ...(payload.version !== undefined ? { version: payload.version } : {})
            });
            const destinationHostPath = await destinationHostPathResolve(destinationPath, toolContext);
            const targetDir = path.join(destinationHostPath, requestedName);
            await fs.rm(targetDir, { recursive: true, force: true });
            await fs.mkdir(destinationHostPath, { recursive: true });
            await fs.cp(matched.path, targetDir, { recursive: true });

            const summary = `Skill "${requestedName}" v${matched.version} ejected to ${destinationPath}.`;
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
                typedResult: { summary, skillName: requestedName, status: "ejected", version: matched.version }
            };
        }
    };
}

async function destinationHostPathResolve(destinationPath: string, toolContext: ToolExecutionContext): Promise<string> {
    const destinationSandboxPath =
        path.isAbsolute(destinationPath) || destinationPath.startsWith("~")
            ? destinationPath
            : path.resolve(toolContext.sandbox.workingDir, destinationPath);
    const markerName = `.daycare-skill-eject-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const markerSandboxPath = destinationSandboxPath.startsWith("~")
        ? path.posix.join(destinationSandboxPath, markerName)
        : path.resolve(destinationSandboxPath, markerName);
    const marker = await toolContext.sandbox.write({
        path: markerSandboxPath,
        content: "",
        exclusive: true
    });
    await fs.rm(marker.resolvedPath, { force: true });
    return path.dirname(marker.resolvedPath);
}
