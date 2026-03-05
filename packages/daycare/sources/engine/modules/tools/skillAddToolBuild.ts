import { promises as fs } from "node:fs";
import path from "node:path";
import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";
import matter from "gray-matter";
import type { ToolDefinition, ToolResultContract } from "@/types";
import { SKILL_FILENAME } from "../../skills/skillConstants.js";
import { swarmOwnedUserResolve } from "./swarmOwnedUserResolve.js";
import type { ToolExecutionContext } from "./types.js";

const schema = Type.Object(
    {
        path: Type.String({ minLength: 1 }),
        userId: Type.Optional(Type.String({ minLength: 1 }))
    },
    { additionalProperties: false }
);

type SkillAddArgs = Static<typeof schema>;

const resultSchema = Type.Object(
    {
        summary: Type.String(),
        skillName: Type.String(),
        status: Type.String()
    },
    { additionalProperties: false }
);

type SkillAddResult = Static<typeof resultSchema>;

const returns: ToolResultContract<SkillAddResult> = {
    schema: resultSchema,
    toLLMText: (result) => result.summary
};

/**
 * Installs a skill from a local folder path into the user's personal skills directory.
 * Replaces any existing personal skill with the same name.
 * Uses sandbox.read to resolve and validate the source path.
 *
 * Expects: path points to a folder containing a valid SKILL.md with a name in frontmatter.
 */
export function skillAddToolBuild(): ToolDefinition {
    return {
        tool: {
            name: "skill_add",
            description:
                "Install a skill from a local folder path. Copies the skill folder to the personal skills directory, replacing any existing skill with the same name.",
            parameters: schema
        },
        returns,
        visibleByDefault: (context) => context.config.foreground === true,
        execute: async (args, toolContext, toolCall) => {
            const payload = args as SkillAddArgs;
            const target = await skillAddTargetResolve(payload, toolContext);

            const sourcePath = payload.path.trim();
            const skillFileSandboxPath = path.posix.join(sourcePath, SKILL_FILENAME);

            // Read SKILL.md through sandbox to resolve path and validate permissions
            const readResult = await skillFileRead(skillFileSandboxPath, sourcePath, toolContext);
            const skillName = skillNameParse(readResult.content);
            if (!skillName) {
                throw new Error(`No valid ${SKILL_FILENAME} with "name" frontmatter found in: ${sourcePath}`);
            }

            // Prevent path traversal via crafted skill names
            if (!skillNameSafe(skillName)) {
                throw new Error(`Skill name contains invalid characters: "${skillName}".`);
            }

            // Copy source directory to personal skills using host paths
            const sourceHostDir = path.dirname(readResult.resolvedPath);
            const targetDir = path.join(target.personalRoot, skillName);
            const existed = (await statSafe(targetDir))?.isDirectory() ?? false;
            await fs.rm(targetDir, { recursive: true, force: true });
            await fs.mkdir(target.personalRoot, { recursive: true });
            await fs.cp(sourceHostDir, targetDir, { recursive: true });

            const status = existed ? "replaced" : "installed";
            const location = target.userId ? `swarm "${target.userId}" personal skills` : "personal skills";
            const summary =
                status === "replaced"
                    ? `Skill "${skillName}" replaced in ${location}.`
                    : `Skill "${skillName}" installed to ${location}.`;

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
                typedResult: { summary, skillName, status }
            };
        }
    };
}

async function skillAddTargetResolve(
    payload: SkillAddArgs,
    toolContext: ToolExecutionContext
): Promise<{ personalRoot: string; userId: string | null }> {
    const targetUserId = payload.userId?.trim();
    if (!targetUserId) {
        const personalRoot = toolContext.skillsPersonalRoot;
        if (!personalRoot) {
            throw new Error("Personal skills directory is not configured.");
        }
        return { personalRoot, userId: null };
    }

    const swarmUser = await swarmOwnedUserResolve({
        toolContext,
        userId: targetUserId,
        ownerError: "Only the owner user can install skills to swarms."
    });
    return {
        personalRoot: toolContext.agentSystem.userHomeForUserId(swarmUser.id).skillsPersonal,
        userId: swarmUser.id
    };
}

/** Reads a skill file through sandbox.read. Wraps errors with model-facing paths. */
async function skillFileRead(
    skillFileSandboxPath: string,
    sourcePath: string,
    toolContext: ToolExecutionContext
): Promise<{ content: string; resolvedPath: string }> {
    try {
        const result = await toolContext.sandbox.read({ path: skillFileSandboxPath });
        if (result.type !== "text") {
            throw new Error(`Source path is not a valid skill directory: ${sourcePath}`);
        }
        return { content: result.content, resolvedPath: result.resolvedPath };
    } catch (error) {
        if (error instanceof Error) {
            const code = (error as NodeJS.ErrnoException).code;
            if (code === "ENOENT" || code === "ENOTDIR") {
                throw new Error(`Source path is not a valid skill directory: ${sourcePath}`);
            }
            if (error.message === "Path is not a file.") {
                throw new Error(`Source path is not a valid skill directory: ${sourcePath}`);
            }
        }
        throw error;
    }
}

function skillNameParse(content: string): string | null {
    try {
        const parsed = matter(content);
        const name = parsed.data.name;
        if (typeof name === "string" && name.trim().length > 0) {
            return name.trim();
        }
        return null;
    } catch {
        return null;
    }
}

/** Rejects names with path separators, dots-only, or traversal patterns. */
function skillNameSafe(name: string): boolean {
    return !/[/\\]/.test(name) && name !== "." && name !== ".." && !name.startsWith(".");
}

async function statSafe(target: string): Promise<import("node:fs").Stats | null> {
    try {
        return await fs.stat(target);
    } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === "ENOENT" || code === "ENOTDIR" || code === "EACCES") {
            return null;
        }
        throw error;
    }
}
