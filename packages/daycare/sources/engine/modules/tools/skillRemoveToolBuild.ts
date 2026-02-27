import { promises as fs } from "node:fs";
import path from "node:path";
import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";
import matter from "gray-matter";
import type { ToolDefinition, ToolResultContract } from "@/types";
import { SKILL_FILENAME } from "../../skills/skillConstants.js";

const schema = Type.Object(
    {
        name: Type.String({ minLength: 1 })
    },
    { additionalProperties: false }
);

type SkillRemoveArgs = Static<typeof schema>;

const resultSchema = Type.Object(
    {
        summary: Type.String(),
        skillName: Type.String(),
        status: Type.String()
    },
    { additionalProperties: false }
);

type SkillRemoveResult = Static<typeof resultSchema>;

const returns: ToolResultContract<SkillRemoveResult> = {
    schema: resultSchema,
    toLLMText: (result) => result.summary
};

/**
 * Removes a personal skill by name from the user's personal skills directory.
 *
 * Expects: name matches the frontmatter name of a skill in the personal skills root.
 */
export function skillRemoveToolBuild(): ToolDefinition {
    return {
        tool: {
            name: "skill_remove",
            description: "Remove a personal skill by name. Only removes skills from the personal skills directory.",
            parameters: schema
        },
        returns,
        visibleByDefault: (context) => context.descriptor.type === "user",
        execute: async (args, toolContext, toolCall) => {
            const payload = args as SkillRemoveArgs;
            const personalRoot = toolContext.skillsPersonalRoot;
            if (!personalRoot) {
                throw new Error("Personal skills directory is not configured.");
            }

            const requestedName = payload.name.trim();
            if (!requestedName) {
                throw new Error("Skill name is required.");
            }

            const matchedDir = await skillFolderFind(personalRoot, requestedName);
            if (!matchedDir) {
                throw new Error(`Personal skill not found: "${requestedName}".`);
            }

            await fs.rm(matchedDir, { recursive: true, force: true });

            const summary = `Skill "${requestedName}" removed from personal skills.`;
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
                typedResult: { summary, skillName: requestedName, status: "removed" }
            };
        }
    };
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
