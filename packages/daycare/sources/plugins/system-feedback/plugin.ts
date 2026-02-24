import { promises as fs } from "node:fs";
import path from "node:path";
import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";
import { z } from "zod";
import type { ToolResultContract } from "@/types";
import { definePlugin } from "../../engine/plugins/types.js";

const SYSTEM_FEEDBACK_TOOL_NAME = "system_feedback";
const SYSTEM_FEEDBACK_ORIGIN = "plugin:system-feedback";
const FEEDBACK_LOG_FILE_NAME = "feedback.log";

const settingsSchema = z
    .object({
        targetAgentId: z.string().trim().min(1).optional()
    })
    .passthrough();

type SystemFeedbackSettings = z.infer<typeof settingsSchema>;

const systemFeedbackSchema = Type.Object(
    {
        prompt: Type.String({
            description: "Feedback text describing what is not working or what capability is needed",
            minLength: 1
        })
    },
    { additionalProperties: false }
);

type SystemFeedbackArgs = Static<typeof systemFeedbackSchema>;

const systemFeedbackResultSchema = Type.Object(
    {
        success: Type.Boolean(),
        message: Type.String(),
        delivered: Type.Boolean(),
        targetAgentId: Type.Optional(Type.String()),
        feedbackLogPath: Type.String()
    },
    { additionalProperties: false }
);

type SystemFeedbackResult = Static<typeof systemFeedbackResultSchema>;

const systemFeedbackReturns: ToolResultContract<SystemFeedbackResult> = {
    schema: systemFeedbackResultSchema,
    toLLMText: (result) => result.message
};

export const plugin = definePlugin({
    settingsSchema,
    onboarding: async (api) => {
        const targetAgentIdInput = await api.prompt.input({
            message: "Target agent ID for forwarded feedback (optional, leave empty for log-only mode)"
        });
        if (targetAgentIdInput === null) {
            return null;
        }

        const targetAgentId = targetAgentIdInput.trim();
        if (!targetAgentId) {
            return {
                settings: {}
            };
        }

        return {
            settings: {
                targetAgentId
            }
        };
    },
    create: (api) => {
        const settings = api.settings as SystemFeedbackSettings;

        return {
            load: async () => {
                api.registrar.registerTool({
                    tool: {
                        name: SYSTEM_FEEDBACK_TOOL_NAME,
                        description:
                            "Send structured system feedback with sender metadata. " +
                            "Logs every feedback entry and optionally forwards it to a configured agent.",
                        parameters: systemFeedbackSchema
                    },
                    returns: systemFeedbackReturns,
                    execute: async (args, context, toolCall) => {
                        const logPath = path.join(api.dataDir, FEEDBACK_LOG_FILE_NAME);
                        const payload = args as SystemFeedbackArgs;
                        const prompt = payload.prompt.trim();
                        if (!prompt) {
                            return systemFeedbackResultBuild(
                                toolCall.id,
                                toolCall.name,
                                "Feedback prompt is required.",
                                false,
                                false,
                                settings.targetAgentId,
                                logPath
                            );
                        }

                        try {
                            const user = await context.agentSystem.storage.users.findById(context.ctx.userId);
                            if (!user) {
                                return systemFeedbackResultBuild(
                                    toolCall.id,
                                    toolCall.name,
                                    `User not found for id ${context.ctx.userId}.`,
                                    false,
                                    false,
                                    settings.targetAgentId,
                                    logPath
                                );
                            }

                            const userName = user.name?.trim() || "Unknown";
                            const userNametag = user.nametag?.trim() || "unknown";
                            const formattedNametag = userNametag.startsWith("@") ? userNametag : `@${userNametag}`;

                            const messageText = [
                                "## System Feedback",
                                "",
                                `**From agent:** ${context.agent.id}`,
                                `**From user:** ${userName} (${formattedNametag}, id: ${context.ctx.userId})`,
                                "",
                                "### Feedback",
                                prompt
                            ].join("\n");

                            const logEntry = {
                                timestamp: Date.now(),
                                agentId: context.agent.id,
                                userId: context.ctx.userId,
                                nametag: userNametag,
                                name: userName,
                                prompt
                            };

                            await fs.appendFile(logPath, `${JSON.stringify(logEntry)}\n`, "utf8");

                            if (settings.targetAgentId) {
                                await context.agentSystem.post(
                                    context.ctx,
                                    { agentId: settings.targetAgentId },
                                    {
                                        type: "system_message",
                                        text: messageText,
                                        origin: SYSTEM_FEEDBACK_ORIGIN,
                                        silent: false,
                                        execute: false
                                    }
                                );

                                return systemFeedbackResultBuild(
                                    toolCall.id,
                                    toolCall.name,
                                    `Feedback logged and delivered to agent ${settings.targetAgentId}.`,
                                    true,
                                    true,
                                    settings.targetAgentId,
                                    logPath
                                );
                            }

                            return systemFeedbackResultBuild(
                                toolCall.id,
                                toolCall.name,
                                "Feedback logged in log-only mode (no target agent configured).",
                                true,
                                false,
                                undefined,
                                logPath
                            );
                        } catch (error) {
                            const reason = error instanceof Error ? error.message : String(error);
                            return systemFeedbackResultBuild(
                                toolCall.id,
                                toolCall.name,
                                `Failed to submit system feedback: ${reason}`,
                                false,
                                false,
                                settings.targetAgentId,
                                logPath
                            );
                        }
                    }
                });
            },
            unload: async () => {
                api.registrar.unregisterTool(SYSTEM_FEEDBACK_TOOL_NAME);
            }
        };
    }
});

function systemFeedbackResultBuild(
    toolCallId: string,
    toolName: string,
    message: string,
    success: boolean,
    delivered: boolean,
    targetAgentId: string | undefined,
    feedbackLogPath: string
): { toolMessage: ToolResultMessage; typedResult: SystemFeedbackResult } {
    return {
        toolMessage: {
            role: "toolResult",
            toolCallId,
            toolName,
            content: [{ type: "text", text: message }],
            isError: !success,
            timestamp: Date.now()
        },
        typedResult: {
            success,
            message,
            delivered,
            targetAgentId,
            feedbackLogPath
        }
    };
}
