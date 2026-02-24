import path from "node:path";
import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { createId } from "@paralleldrive/cuid2";
import { type Static, Type } from "@sinclair/typebox";
import type { SessionPermissions, ToolDefinition, ToolResultContract } from "@/types";
import { sandboxCanRead } from "../../../sandbox/sandboxCanRead.js";
import { agentDescriptorTargetResolve } from "../../agents/ops/agentDescriptorTargetResolve.js";
import { skillActivationKeyBuild } from "../../skills/skillActivationKeyBuild.js";
import { skillContentLoad } from "../../skills/skillContentLoad.js";
import { skillResolve } from "../../skills/skillResolve.js";
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
};

const skillReturns: ToolResultContract<SkillResult> = {
    schema: skillResultSchema,
    toLLMText: (result) => result.summary
};

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
            const workingDir = toolContext.sandbox.workingDir;
            if (!workingDir) {
                throw new Error("Workspace is not configured.");
            }

            const target = await skillTargetResolve(
                requested,
                toolContext.skills ?? [],
                toolContext.sandbox.permissions,
                workingDir
            );
            if (!target) {
                throw skillInputLooksLikePath(requested)
                    ? new Error(`Skill not found at path: ${path.resolve(workingDir, requested)}.`)
                    : new Error(`Unknown skill: ${requested}.`);
            }
            const { skill } = target;

            // Notify connector about skill activation (fire-and-forget for user agents)
            void skillNotifyConnector(skill.name, toolContext);

            const skillFilePath = await skillPathForLoadResolve(skill, target.requestedByPath, toolContext);
            const resolvedSkillPath = await skillPathResolveReadable(toolContext.sandbox.permissions, skillFilePath);
            const skillBody = await skillContentLoad(resolvedSkillPath);
            const skillBodyDecorated = skillBodyDecorate(
                skillBody,
                skill.name,
                skillBaseDirectoryBuild(skill, target.requestedByPath, toolContext, resolvedSkillPath)
            );
            if (skill.sandbox === true) {
                const skillSource = skillSourceBuild(skill.name);
                const prompt = payload.prompt?.trim() ?? "";
                if (!prompt) {
                    throw new Error(`Skill "${skill.name}" requires prompt in sandbox mode.`);
                }

                const descriptor = {
                    type: "subagent" as const,
                    id: createId(),
                    parentAgentId: toolContext.agent.id,
                    name: skillSource
                };
                const agentId = await toolContext.agentSystem.agentIdForTarget(toolContext.ctx, { descriptor });

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
                const body =
                    responseText && responseText.trim().length > 0 ? responseText.trim() : "No response text returned.";
                const toolMessage = toolMessageBuild(
                    toolCall.id,
                    toolCall.name,
                    `Skill executed in sandbox. Result:\n\n---\n\n${body}`
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

            const body = skillBodyDecorated.length > 0 ? skillBodyDecorated : "(Skill body is empty.)";
            const toolMessage = toolMessageBuild(
                toolCall.id,
                toolCall.name,
                `Skill loaded (embedded). Follow the instructions below:\n\n---\n\n${body}`
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
    permissions: SessionPermissions,
    workingDir: string
): Promise<SkillTarget | null> {
    if (skillInputLooksLikePath(requested)) {
        const requestedPath = path.resolve(workingDir, requested);
        const readablePath = await skillPathResolveReadable(permissions, requestedPath);
        const skill = await skillResolve(readablePath, { source: "config" });
        return skill ? { skill, requestedByPath: true } : null;
    }

    const skill = skillByNameResolve(requested, skills);
    return skill ? { skill, requestedByPath: false } : null;
}

async function skillPathResolveReadable(permissions: SessionPermissions, target: string): Promise<string> {
    const resolvedPath = path.resolve(target);
    return sandboxCanRead(permissions, resolvedPath);
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

async function skillPathForLoadResolve(
    skill: AgentSkill,
    requestedByPath: boolean,
    toolContext: ToolExecutionContext
): Promise<string> {
    if (requestedByPath || !toolContext.skillsActiveRoot) {
        return skill.sourcePath;
    }
    const activationKey = skillActivationKeyBuild(skill.id);
    return path.resolve(toolContext.skillsActiveRoot, activationKey, "SKILL.md");
}

function skillBaseDirectoryBuild(
    skill: AgentSkill,
    requestedByPath: boolean,
    toolContext: ToolExecutionContext,
    resolvedSkillPath: string
): string {
    if (requestedByPath || !toolContext.skillsActiveRoot) {
        return path.dirname(resolvedSkillPath);
    }
    const activationKey = skillActivationKeyBuild(skill.id);
    if (toolContext.sandbox.docker?.enabled) {
        return path.posix.join("/shared/skills", activationKey);
    }
    return path.resolve(toolContext.skillsActiveRoot, activationKey);
}

function skillBodyDecorate(skillBody: string, skillName: string, baseDirectory: string): string {
    return [`Base directory for this skill: ${baseDirectory}`, `Skill name: ${skillName}`, "", skillBody.trim()].join(
        "\n"
    );
}

function skillSourceBuild(skillName: string): string {
    return `${skillName} Skill`;
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
        const target = agentDescriptorTargetResolve(toolContext.agent.descriptor);
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
