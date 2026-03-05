import { promises as fs } from "node:fs";
import path from "node:path";
import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";
import matter from "gray-matter";
import type { ToolDefinition, ToolResultContract } from "@/types";
import { SKILL_FILENAME } from "../../skills/skillConstants.js";
import type { ToolExecutionContext } from "./types.js";

const schema = Type.Object(
    {
        name: Type.String({ minLength: 1 }),
        path: Type.String({ minLength: 1 })
    },
    { additionalProperties: false }
);

type SkillEjectArgs = Static<typeof schema>;

const resultSchema = Type.Object(
    {
        summary: Type.String(),
        skillName: Type.String(),
        status: Type.String()
    },
    { additionalProperties: false }
);

type SkillEjectResult = Static<typeof resultSchema>;

const returns: ToolResultContract<SkillEjectResult> = {
    schema: resultSchema,
    toLLMText: (result) => result.summary
};

/**
 * Copies a personal skill folder to a destination sandbox path for external inspection or editing.
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

            const matchedDir = await skillFolderFind(personalRoot, requestedName);
            if (!matchedDir) {
                throw new Error(`Personal skill not found: "${requestedName}".`);
            }

            const destinationHostPath = await destinationHostPathResolve(destinationPath, toolContext);
            const targetDir = path.join(destinationHostPath, path.basename(matchedDir));
            await fs.rm(targetDir, { recursive: true, force: true });
            await fs.mkdir(destinationHostPath, { recursive: true });
            await fs.cp(matchedDir, targetDir, { recursive: true });

            const summary = `Skill "${requestedName}" ejected to ${destinationPath}.`;
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
                typedResult: { summary, skillName: requestedName, status: "ejected" }
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

/**
 * Scans the personal skills root for a folder whose SKILL.md has a matching name.
 * Returns the matched folder path, or null if not found.
 */
async function skillFolderFind(personalRoot: string, targetName: string): Promise<string | null> {
    let entries: Array<import("node:fs").Dirent> = [];
    try {
        entries = await fs.readdir(personalRoot, { withFileTypes: true });
    } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === "ENOENT" || code === "ENOTDIR") {
            return null;
        }
        throw error;
    }

    const normalized = targetName.toLowerCase();
    for (const entry of entries) {
        if (!entry.isDirectory()) {
            continue;
        }
        const skillFilePath = path.join(personalRoot, entry.name, SKILL_FILENAME);
        const name = await skillNameRead(skillFilePath);
        if (name && name.toLowerCase() === normalized) {
            return path.join(personalRoot, entry.name);
        }
    }
    return null;
}

async function skillNameRead(skillFilePath: string): Promise<string | null> {
    let content = "";
    try {
        content = await fs.readFile(skillFilePath, "utf8");
    } catch {
        return null;
    }
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
