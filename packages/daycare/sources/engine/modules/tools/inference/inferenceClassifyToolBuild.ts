import type { Context, ToolResultMessage } from "@mariozechner/pi-ai";
import { createId } from "@paralleldrive/cuid2";
import { type Static, Type } from "@sinclair/typebox";
import type { ToolDefinition, ToolResultContract } from "@/types";
import type { ConfigModule } from "../../../config/configModule.js";
import { messageExtractText } from "../../../messages/messageExtractText.js";
import type { InferenceRouter } from "../../inference/router.js";
import { inferenceClassifyParse } from "./inferenceClassifyParse.js";
import { inferenceResolveProviders } from "./inferenceResolveProviders.js";

const schema = Type.Object(
    {
        text: Type.String({ minLength: 1 }),
        variants: Type.Array(
            Type.Object(
                {
                    class: Type.String({ minLength: 1 }),
                    description: Type.String({ minLength: 1 })
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
 * Expects: variants list contains unique class names and non-empty descriptions.
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
            const text = payload.text.trim();
            if (!text) {
                throw new Error("text is required.");
            }

            const variants = payload.variants.map((entry) => ({
                class: entry.class.trim(),
                description: entry.description.trim()
            }));
            if (variants.some((entry) => entry.class.length === 0 || entry.description.length === 0)) {
                throw new Error("Each variant must include non-empty class and description.");
            }
            const classNames = variants.map((entry) => entry.class);
            if (new Set(classNames).size !== classNames.length) {
                throw new Error("variant classes must be unique.");
            }

            const providersOverride = inferenceResolveProviders(config, payload.model);
            if (providersOverride.length === 0) {
                throw new Error("No inference provider available.");
            }

            const inferenceContext: Context = {
                systemPrompt: inferenceClassifySystemPromptBuild(variants),
                messages: [{ role: "user", content: text, timestamp: Date.now() }]
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

function inferenceClassifySystemPromptBuild(variants: InferenceClassifyVariant[]): string {
    const categories = variants.map((variant) => `- ${variant.class}: ${variant.description}`).join("\n");

    return [
        "You are a precise text classification engine. Your task is to read the user-provided text, write a brief summary, and assign it to exactly one of the categories listed below.",
        "",
        "Categories:",
        categories,
        "",
        "Rules:",
        "- The <class> value MUST be one of the category names listed above, copied exactly.",
        "- The <summary> should be a short plain-prose summary (1-3 sentences) capturing the gist of the text.",
        "- Do not invent categories. If the text does not clearly fit any category, pick the closest match.",
        "",
        "Output format (nothing else):",
        "<summary>Brief summary of the text.</summary>",
        "<class>exact_category_name</class>"
    ].join("\n");
}
