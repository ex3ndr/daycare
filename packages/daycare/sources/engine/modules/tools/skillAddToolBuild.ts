import { promises as fs } from "node:fs";
import path from "node:path";
import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";
import matter from "gray-matter";
import type { ToolDefinition, ToolResultContract } from "@/types";
import { SKILL_FILENAME } from "../../skills/skillConstants.js";
import type { ToolExecutionContext } from "./types.js";

const SKILL_FILENAME_LEGACY = "SKILL.md";

const schema = Type.Object(
    {
        path: Type.String({ minLength: 1 })
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
type SkillFileProbeFailure = {
    path: string;
    reason: string;
};

const returns: ToolResultContract<SkillAddResult> = {
    schema: resultSchema,
    toLLMText: (result) => result.summary
};

/**
 * Installs a skill from a local path into the user's personal skills directory.
 * Replaces any existing personal skill with the same name.
 * Uses sandbox.read to resolve and validate the source path.
 *
 * Expects: path points to a folder (or direct skill file) with a valid skill file name and frontmatter name.
 */
export function skillAddToolBuild(): ToolDefinition {
    return {
        tool: {
            name: "skill_add",
            description:
                "Install a skill from a local folder or skill file path. Copies the skill folder to the personal skills directory, replacing any existing skill with the same name.",
            parameters: schema
        },
        returns,
        visibleByDefault: (context) => context.descriptor.type === "user",
        execute: async (args, toolContext, toolCall) => {
            const payload = args as SkillAddArgs;
            const personalRoot = toolContext.skillsPersonalRoot;
            if (!personalRoot) {
                throw new Error("Personal skills directory is not configured.");
            }

            const sourcePath = payload.path.trim();
            if (!sourcePath) {
                throw new Error("Source path is required.");
            }

            // Read skill file through sandbox to resolve path and validate permissions.
            // Accept both canonical "skill.md" and legacy "SKILL.md" naming.
            const readResult = await skillFileRead(sourcePath, toolContext);
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
            const targetDir = path.join(personalRoot, skillName);
            const existed = (await statSafe(targetDir))?.isDirectory() ?? false;
            await fs.rm(targetDir, { recursive: true, force: true });
            await fs.mkdir(personalRoot, { recursive: true });
            await fs.cp(sourceHostDir, targetDir, { recursive: true });

            const status = existed ? "replaced" : "installed";
            const summary =
                status === "replaced"
                    ? `Skill "${skillName}" replaced in personal skills.`
                    : `Skill "${skillName}" installed to personal skills.`;

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

/** Reads a skill file through sandbox.read. Wraps errors with model-facing paths. */
async function skillFileRead(
    sourcePath: string,
    toolContext: ToolExecutionContext
): Promise<{ content: string; resolvedPath: string }> {
    const failures: SkillFileProbeFailure[] = [];
    for (const skillFileSandboxPath of skillFileSandboxPathsBuild(sourcePath)) {
        try {
            const result = await toolContext.sandbox.read({ path: skillFileSandboxPath });
            if (result.type !== "text") {
                failures.push({ path: skillFileSandboxPath, reason: `expected text file, got ${result.type}` });
                continue;
            }
            return { content: result.content, resolvedPath: result.resolvedPath };
        } catch (error) {
            const failure = skillFileProbeFailureBuild(skillFileSandboxPath, error);
            if (failure) {
                failures.push(failure);
                continue;
            }
            throw error;
        }
    }
    throw new Error(skillFileProbeSummaryFormat(sourcePath, failures));
}

function skillFileSandboxPathsBuild(sourcePath: string): string[] {
    const normalizedSourcePath = path.posix.normalize(sourcePath);
    const fileName = path.posix.basename(normalizedSourcePath).toLowerCase();
    if (fileName === SKILL_FILENAME) {
        const sourceDir = path.posix.dirname(normalizedSourcePath);
        const preferred = path.posix.join(sourceDir, SKILL_FILENAME);
        const legacy = path.posix.join(sourceDir, SKILL_FILENAME_LEGACY);
        return Array.from(new Set([preferred, legacy]));
    }
    const candidates = [
        path.posix.join(normalizedSourcePath, SKILL_FILENAME),
        path.posix.join(normalizedSourcePath, SKILL_FILENAME_LEGACY)
    ];
    return Array.from(new Set(candidates));
}

function skillFileProbeFailureBuild(probePath: string, error: unknown): SkillFileProbeFailure | null {
    if (!(error instanceof Error)) {
        return null;
    }
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR") {
        return { path: probePath, reason: "not found" };
    }
    if (code === "EACCES" || code === "EPERM") {
        return { path: probePath, reason: "permission denied" };
    }
    if (error.message === "Path is not a file.") {
        return { path: probePath, reason: "not a file" };
    }
    if (error.message === "Cannot read symbolic link directly.") {
        return { path: probePath, reason: "symbolic links are not supported" };
    }
    if (error.message.startsWith("Read permission denied:")) {
        return { path: probePath, reason: "read permission denied by sandbox" };
    }
    if (error.message.startsWith("Path is not mapped to host filesystem:")) {
        return { path: probePath, reason: "path is outside sandbox mounts" };
    }
    return null;
}

function skillFileProbeSummaryFormat(sourcePath: string, failures: SkillFileProbeFailure[]): string {
    if (failures.length === 0) {
        return `Source path is not a valid skill directory: ${sourcePath}.`;
    }
    const attempts = failures.map((failure) => `${failure.path} (${failure.reason})`).join("; ");
    return (
        `Source path is not a valid skill directory: ${sourcePath}. ` +
        `Expected a readable "${SKILL_FILENAME}" or "${SKILL_FILENAME_LEGACY}" file with "name" frontmatter. ` +
        `Tried: ${attempts}`
    );
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
