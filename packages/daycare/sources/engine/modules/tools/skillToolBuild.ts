import path from "node:path";
import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";
import matter from "gray-matter";
import type { ToolDefinition, ToolResultContract } from "@/types";
import type { SandboxReadResult } from "../../../sandbox/sandboxTypes.js";
import { agentPathChildAllocate } from "../../agents/ops/agentPathChildAllocate.js";
import { agentPathTargetResolve } from "../../agents/ops/agentPathTargetResolve.js";
import { skillActivationKeyBuild } from "../../skills/skillActivationKeyBuild.js";
import type { AgentSkill } from "../../skills/skillTypes.js";
import { toolMessageTextExtract } from "./toolReturnOutcome.js";
import type { ToolExecutionContext } from "./types.js";

const schema = Type.Object(
    {
        name: Type.String({ minLength: 1 }),
        prompt: Type.Optional(Type.String())
    },
    { additionalProperties: false }
);

type SkillToolArgs = Static<typeof schema>;

const skillResultSchema = Type.Object(
    {
        summary: Type.String(),
        skillName: Type.String(),
        mode: Type.String(),
        sandboxed: Type.Boolean()
    },
    { additionalProperties: false }
);

type SkillResult = Static<typeof skillResultSchema>;

type SkillTarget = {
    skill: AgentSkill;
    requestedByPath: boolean;
    /** Pre-loaded body (frontmatter stripped) for path-based skills to avoid double-read. */
    preloadedBody?: string;
};

const skillReturns: ToolResultContract<SkillResult> = {
    schema: skillResultSchema,
    toLLMText: (result) => result.summary
};

/**
 * Builds the "skill" tool that loads and runs skills by name or SKILL.md path.
 * Named skills are always loaded via the /shared/skills sandbox mount.
 * Path-based skills are loaded via sandbox.read on the requested path.
 */
export function skillToolBuild(): ToolDefinition {
    return {
        tool: {
            name: "skill",
            description: "Load and run a skill by name or SKILL.md path.",
            parameters: schema
        },
        returns: skillReturns,
        execute: async (args, toolContext, toolCall) => {
            const payload = args as SkillToolArgs;
            const requested = payload.name.trim();
            if (!requested) {
                throw new Error("Skill name is required.");
            }

            const target = await skillTargetResolve(requested, toolContext.skills ?? [], toolContext);
            if (!target) {
                throw skillInputLooksLikePath(requested)
                    ? new Error(`Skill not found at path: ${requested}.`)
                    : new Error(`Unknown skill: ${requested}.`);
            }
            const { skill } = target;

            // Notify connector about skill activation (fire-and-forget for user agents)
            void skillNotifyConnector(skill.name, toolContext);

            const loaded = await skillContentRead(target, toolContext);
            const skillBodyDecorated = skillBodyDecorate(loaded.body, skill.name, loaded.baseDir);
            if (skill.sandbox === true) {
                const prompt = payload.prompt?.trim() ?? "";
                if (!prompt) {
                    throw new Error(`Skill "${skill.name}" requires prompt in sandbox mode.`);
                }

                const path = await agentPathChildAllocate({
                    storage: toolContext.agentSystem.storage,
                    parentAgentId: toolContext.agent.id,
                    kind: "sub"
                });
                const agentId = await toolContext.agentSystem.agentIdForTarget(
                    toolContext.ctx,
                    { path },
                    {
                        kind: "sub",
                        parentAgentId: toolContext.agent.id,
                        name: skill.name
                    }
                );

                const sandboxPrompt = skillSandboxPromptBuild(skillBodyDecorated, prompt);
                const result = await toolContext.agentSystem.postAndAwait(
                    toolContext.ctx,
                    { agentId },
                    {
                        type: "message",
                        message: { text: sandboxPrompt },
                        context: {}
                    }
                );
                const responseText = "responseText" in result ? result.responseText : null;
                const responseBody =
                    responseText && responseText.trim().length > 0 ? responseText.trim() : "No response text returned.";
                const toolMessage = toolMessageBuild(
                    toolCall.id,
                    toolCall.name,
                    `Skill executed in sandbox. Result:\n\n---\n\n${responseBody}`
                );
                return {
                    toolMessage,
                    typedResult: {
                        summary: toolMessageTextExtract(toolMessage),
                        skillName: skill.name,
                        mode: "sandbox",
                        sandboxed: true
                    }
                };
            }

            const displayBody = skillBodyDecorated.length > 0 ? skillBodyDecorated : "(Skill body is empty.)";
            const toolMessage = toolMessageBuild(
                toolCall.id,
                toolCall.name,
                `Skill loaded (embedded). Follow the instructions below:\n\n---\n\n${displayBody}`
            );
            return {
                toolMessage,
                typedResult: {
                    summary: toolMessageTextExtract(toolMessage),
                    skillName: skill.name,
                    mode: "embedded",
                    sandboxed: false
                }
            };
        }
    };
}

async function skillTargetResolve(
    requested: string,
    skills: AgentSkill[],
    toolContext: ToolExecutionContext
): Promise<SkillTarget | null> {
    if (skillInputLooksLikePath(requested)) {
        return skillTargetFromPathResolve(requested, toolContext);
    }

    const skill = skillByNameResolve(requested, skills);
    return skill ? { skill, requestedByPath: false } : null;
}

/**
 * Reads a SKILL.md via sandbox.read, parses frontmatter, and returns a SkillTarget.
 * Permission errors from sandbox.read propagate; file-not-found returns null.
 */
async function skillTargetFromPathResolve(
    requested: string,
    toolContext: ToolExecutionContext
): Promise<SkillTarget | null> {
    let result: SandboxReadResult;
    try {
        result = await toolContext.sandbox.read({ path: requested });
    } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === "ENOENT" || code === "ENOTDIR") {
            return null;
        }
        throw error;
    }
    if (result.type !== "text") {
        return null;
    }
    const parsed = skillFrontmatterParse(result.content);
    if (!parsed.name) {
        return null;
    }
    const skill: AgentSkill = {
        id: `path:${requested}`,
        name: parsed.name,
        description: parsed.description,
        sandbox: parsed.sandbox,
        permissions: parsed.permissions,
        sourcePath: requested,
        source: "config"
    };
    return { skill, requestedByPath: true, preloadedBody: parsed.body };
}

/**
 * Reads skill body via sandbox paths. Named skills load from /shared/skills mount.
 * Path-based skills use pre-loaded content from skillTargetFromPathResolve.
 */
async function skillContentRead(
    target: SkillTarget,
    toolContext: ToolExecutionContext
): Promise<{ body: string; baseDir: string }> {
    if (target.requestedByPath && target.preloadedBody !== undefined) {
        return {
            body: target.preloadedBody,
            baseDir: path.posix.dirname(target.skill.sourcePath)
        };
    }
    const activationKey = skillActivationKeyBuild(target.skill.id);
    const sandboxPath = `/shared/skills/${activationKey}/SKILL.md`;
    const result = await toolContext.sandbox.read({ path: sandboxPath });
    if (result.type !== "text") {
        throw new Error("Skill file must be a text file.");
    }
    return {
        body: skillFrontmatterStrip(result.content),
        baseDir: `/shared/skills/${activationKey}`
    };
}

function skillInputLooksLikePath(value: string): boolean {
    return (
        path.isAbsolute(value) ||
        value.includes("/") ||
        value.includes("\\") ||
        value.startsWith(".") ||
        value.toLowerCase().endsWith(".md")
    );
}

function skillByNameResolve(requested: string, skills: AgentSkill[]): AgentSkill | null {
    for (const skill of skills) {
        if (skill.name === requested || skill.id === requested) {
            return skill;
        }
    }

    const normalized = requested.toLowerCase();
    for (const skill of skills) {
        if (skill.name.toLowerCase() === normalized || skill.id.toLowerCase() === normalized) {
            return skill;
        }
    }

    return null;
}

function skillFrontmatterParse(content: string): {
    name: string | null;
    description: string | null;
    sandbox?: boolean;
    permissions?: string[];
    body: string;
} {
    try {
        const parsed = matter(content);
        const data = parsed.data as Record<string, unknown>;
        const name = typeof data.name === "string" && data.name.trim().length > 0 ? data.name.trim() : null;
        const description =
            typeof data.description === "string" && data.description.trim().length > 0 ? data.description.trim() : null;
        let sandbox: boolean | undefined;
        if (data.sandbox === true) {
            sandbox = true;
        } else if (typeof data.sandbox === "string" && data.sandbox.trim().toLowerCase() === "true") {
            sandbox = true;
        } else if (
            data.sandbox === false ||
            (typeof data.sandbox === "string" && data.sandbox.trim().toLowerCase() === "false")
        ) {
            sandbox = false;
        }
        let permissions: string[] | undefined;
        if (Array.isArray(data.permissions)) {
            const filtered = data.permissions
                .filter((v): v is string => typeof v === "string")
                .map((v) => v.trim())
                .filter((v) => v.length > 0);
            if (filtered.length > 0) {
                permissions = Array.from(new Set(filtered));
            }
        } else if (typeof data.permissions === "string" && data.permissions.trim().length > 0) {
            permissions = [data.permissions.trim()];
        }
        return { name, description, sandbox, permissions, body: parsed.content.trim() };
    } catch {
        return { name: null, description: null, body: content.trim() };
    }
}

function skillFrontmatterStrip(content: string): string {
    try {
        return matter(content).content.trim();
    } catch {
        return content.trim();
    }
}

function skillBodyDecorate(skillBody: string, skillName: string, baseDirectory: string): string {
    return [`Base directory for this skill: ${baseDirectory}`, `Skill name: ${skillName}`, "", skillBody.trim()].join(
        "\n"
    );
}

function skillSandboxPromptBuild(skillBody: string, prompt: string): string {
    return [
        "Follow the skill instructions and complete the task.",
        "",
        "## Skill",
        skillBody,
        "",
        "## Task",
        prompt
    ].join("\n");
}

function toolMessageBuild(toolCallId: string, toolName: string, text: string): ToolResultMessage {
    return {
        role: "toolResult",
        toolCallId,
        toolName,
        content: [{ type: "text", text }],
        isError: false,
        timestamp: Date.now()
    };
}

/**
 * Sends a user-facing notification to the connector when a skill is loaded.
 * Only fires for user-type agents that have a direct connector with text support.
 * Entirely best-effort; failures are silently ignored.
 */
async function skillNotifyConnector(skillName: string, toolContext: ToolExecutionContext): Promise<void> {
    try {
        const target = await agentPathTargetResolve(
            toolContext.agentSystem.storage,
            toolContext.ctx.userId,
            toolContext.agent.config
        );
        if (!target) {
            return;
        }
        const connector = toolContext.connectorRegistry.get(target.connector);
        if (!connector?.capabilities.sendText) {
            return;
        }
        await connector.sendMessage(target.targetId, { text: `⚡ Skill loaded: ${skillName}` });
    } catch {
        // Best-effort notification; do not break skill execution
    }
}
