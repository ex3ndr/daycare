import path from "node:path";
import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { createId } from "@paralleldrive/cuid2";
import { type Static, Type } from "@sinclair/typebox";
import type { ToolDefinition, ToolResultContract } from "@/types";
import { agentDescriptorTargetResolve } from "../../agents/ops/agentDescriptorTargetResolve.js";
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

            const skill = await skillTargetResolve(
                requested,
                toolContext.skills ?? [],
                toolContext.permissions.workingDir
            );
            if (!skill) {
                throw skillInputLooksLikePath(requested)
                    ? new Error(
                          `Skill not found at path: ${path.resolve(toolContext.permissions.workingDir, requested)}.`
                      )
                    : new Error(`Unknown skill: ${requested}.`);
            }

            // Notify connector about skill activation (fire-and-forget for user agents)
            void skillNotifyConnector(skill.name, toolContext);

            const skillBody = await skillContentLoad(skill.path);
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
                const agentId = await toolContext.agentSystem.agentIdForTarget({ descriptor });

                const sandboxPrompt = skillSandboxPromptBuild(skillBody, prompt);
                const result = await toolContext.agentSystem.postAndAwait(
                    { agentId },
                    { type: "message", message: { text: sandboxPrompt }, context: {} }
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

            const body = skillBody.length > 0 ? skillBody : "(Skill body is empty.)";
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
    workingDir: string
): Promise<AgentSkill | null> {
    if (skillInputLooksLikePath(requested)) {
        return skillResolve(path.resolve(workingDir, requested), { source: "config" });
    }

    return skillByNameResolve(requested, skills);
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
