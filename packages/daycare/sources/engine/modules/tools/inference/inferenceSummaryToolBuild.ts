import type { Context, ToolResultMessage } from "@mariozechner/pi-ai";
import { createId } from "@paralleldrive/cuid2";
import { type Static, Type } from "@sinclair/typebox";
import type { ToolDefinition, ToolResultContract } from "@/types";
import type { ConfigModule } from "../../../config/configModule.js";
import { messageExtractText } from "../../../messages/messageExtractText.js";
import type { InferenceRouter } from "../../inference/router.js";
import { inferenceResolveProviders } from "./inferenceResolveProviders.js";
import { inferenceSummaryParse } from "./inferenceSummaryParse.js";
import { inferenceValueStringify } from "./inferenceValueStringify.js";

const inferenceSummarySystemPrompt = [
    "You are a precise summarization engine.",
    "The user message includes <task> and <text> tags.",
    "",
    "Rules:",
    "- Follow the requested task using the text content as source material.",
    "- Write the summary in plain prose, not bullet points.",
    "- Keep the summary significantly shorter than the source text.",
    "- Preserve factual accuracy; do not add information that is not in the source text.",
    "- Wrap your entire summary inside <summary> tags.",
    "",
    "Output format (nothing else):",
    "<summary>Your concise summary here.</summary>"
].join("\n");

const schema = Type.Object(
    {
        task: Type.Unknown(),
        text: Type.Unknown(),
        model: Type.Optional(Type.String({ minLength: 1 }))
    },
    { additionalProperties: false }
);

type InferenceSummaryArgs = Static<typeof schema>;

const inferenceSummaryResultSchema = Type.Object(
    {
        summary: Type.String()
    },
    { additionalProperties: false }
);

type InferenceSummaryResult = Static<typeof inferenceSummaryResultSchema>;

const inferenceSummaryReturns: ToolResultContract<InferenceSummaryResult> = {
    schema: inferenceSummaryResultSchema,
    toLLMText: (result) => result.summary
};

/**
 * Builds a summarization inference tool with optional model selection.
 * Expects: inferenceRouter is configured with at least one inference provider.
 */
export function inferenceSummaryToolBuild(inferenceRouter: InferenceRouter, config: ConfigModule): ToolDefinition {
    return {
        tool: {
            name: "inference_summary",
            description:
                "Summarize a piece of text with an LLM. Optionally choose model size (small, normal, large) or an explicit model id.",
            parameters: schema
        },
        returns: inferenceSummaryReturns,
        execute: async (args, _toolContext, toolCall) => {
            const payload = args as InferenceSummaryArgs;
            const task = inferenceValueStringify(payload.task, "task");
            const text = inferenceValueStringify(payload.text, "text");

            const providersOverride = inferenceResolveProviders(config, payload.model);
            if (providersOverride.length === 0) {
                throw new Error("No inference provider available.");
            }

            const inferenceContext: Context = {
                systemPrompt: inferenceSummarySystemPrompt,
                messages: [
                    { role: "user", content: inferenceSummaryUserMessageBuild(task, text), timestamp: Date.now() }
                ]
            };

            const response = await inferenceRouter.complete(inferenceContext, `tool:inference_summary:${createId()}`, {
                providersOverride
            });
            const responseText = messageExtractText(response.message)?.trim();
            if (!responseText) {
                throw new Error("Inference returned empty output.");
            }

            const summary = inferenceSummaryParse(responseText).trim();
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
                typedResult: { summary }
            };
        }
    };
}

function inferenceSummaryUserMessageBuild(task: string, text: string): string {
    return ["<task>", task, "</task>", "", "<text>", text, "</text>"].join("\n");
}
