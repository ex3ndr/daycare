import type { Context, ToolResultMessage } from "@mariozechner/pi-ai";
import { createId } from "@paralleldrive/cuid2";
import { type Static, Type } from "@sinclair/typebox";
import type { ToolDefinition, ToolResultContract } from "@/types";
import type { ConfigModule } from "../../../config/configModule.js";
import { messageExtractText } from "../../../messages/messageExtractText.js";
import type { InferenceRouter } from "../../inference/router.js";
import { inferenceClassifyParse } from "./inferenceClassifyParse.js";
import { inferenceResolveProviders } from "./inferenceResolveProviders.js";
import { inferenceValueStringify } from "./inferenceValueStringify.js";

const inferenceClassifySystemPrompt = [
    "You are a precise text classification engine.",
    "The user message includes <task>, <categories>, and <text> tags.",
    "",
    "Rules:",
    "- Use the requested task to interpret the text and classification context.",
    "- The <class> value MUST be one of the category names listed in <categories>, copied exactly.",
    "- The <summary> should be a short plain-prose summary (1-3 sentences) capturing the gist of the text.",
    "- Do not invent categories. If the text does not clearly fit any category, pick the closest match.",
    "",
    "Output format (nothing else):",
    "<summary>Brief summary of the text.</summary>",
    "<class>exact_category_name</class>"
].join("\n");

const schema = Type.Object(
    {
        task: Type.Unknown(),
        text: Type.Unknown(),
        variants: Type.Array(
            Type.Object(
                {
                    class: Type.Unknown(),
                    description: Type.Unknown()
                },
                { additionalProperties: false }
            ),
            { minItems: 1 }
        ),
        model: Type.Optional(Type.String({ minLength: 1 }))
    },
    { additionalProperties: false }
);

type InferenceClassifyArgs = Static<typeof schema>;

const inferenceClassifyResultSchema = Type.Object(
    {
        summary: Type.String(),
        class: Type.String()
    },
    { additionalProperties: false }
);

type InferenceClassifyResult = Static<typeof inferenceClassifyResultSchema>;

const inferenceClassifyReturns: ToolResultContract<InferenceClassifyResult> = {
    schema: inferenceClassifyResultSchema,
    toLLMText: (result) => `summary: ${result.summary}\nclass: ${result.class}`
};

/**
 * Builds a classification inference tool with optional model selection.
 * Expects: variants list resolves to unique class names after input normalization.
 */
export function inferenceClassifyToolBuild(inferenceRouter: InferenceRouter, config: ConfigModule): ToolDefinition {
    return {
        tool: {
            name: "inference_classify",
            description:
                "Classify text into exactly one class from a provided variant list. Returns both class and summary.",
            parameters: schema
        },
        returns: inferenceClassifyReturns,
        execute: async (args, _toolContext, toolCall) => {
            const payload = args as InferenceClassifyArgs;
            const task = inferenceValueStringify(payload.task, "task");
            const text = inferenceValueStringify(payload.text, "text");

            const variants = payload.variants.map((entry) => ({
                class: inferenceValueStringify(entry.class, "variants.class"),
                description: inferenceValueStringify(entry.description, "variants.description")
            }));
            const classNames = variants.map((entry) => entry.class);
            if (new Set(classNames).size !== classNames.length) {
                throw new Error("variant classes must be unique.");
            }

            const providersOverride = inferenceResolveProviders(config, payload.model);
            if (providersOverride.length === 0) {
                throw new Error("No inference provider available.");
            }

            const inferenceContext: Context = {
                systemPrompt: inferenceClassifySystemPrompt,
                messages: [
                    {
                        role: "user",
                        content: inferenceClassifyUserMessageBuild(task, variants, text),
                        timestamp: Date.now()
                    }
                ]
            };

            const response = await inferenceRouter.complete(inferenceContext, `tool:inference_classify:${createId()}`, {
                providersOverride
            });
            const responseText = messageExtractText(response.message)?.trim();
            if (!responseText) {
                throw new Error("Inference returned empty output.");
            }

            const parsed = inferenceClassifyParse(responseText, classNames);
            const messageText = parsed.summary ? `${parsed.summary}\nClass: ${parsed.class}` : `Class: ${parsed.class}`;
            const toolMessage: ToolResultMessage = {
                role: "toolResult",
                toolCallId: toolCall.id,
                toolName: toolCall.name,
                content: [{ type: "text", text: messageText }],
                isError: false,
                timestamp: Date.now()
            };

            return {
                toolMessage,
                typedResult: parsed
            };
        }
    };
}

type InferenceClassifyVariant = {
    class: string;
    description: string;
};

function inferenceClassifyUserMessageBuild(task: string, variants: InferenceClassifyVariant[], text: string): string {
    const categories = variants.map((variant) => `- ${variant.class}: ${variant.description}`).join("\n");

    return [
        "<task>",
        task,
        "</task>",
        "",
        "<categories>",
        categories,
        "</categories>",
        "",
        "<text>",
        text,
        "</text>"
    ].join("\n");
}
