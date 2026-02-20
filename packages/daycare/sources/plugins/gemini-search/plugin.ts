import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";
import { z } from "zod";
import type { ToolResultContract } from "@/types";
import { definePlugin } from "../../engine/plugins/types.js";

const settingsSchema = z
    .object({
        toolName: z.string().min(1).optional(),
        model: z.string().min(1).optional()
    })
    .passthrough();

const searchSchema = Type.Object(
    {
        query: Type.String({ minLength: 1, description: "The search query" })
    },
    { additionalProperties: false }
);

type SearchArgs = Static<typeof searchSchema>;

const searchResultSchema = Type.Object(
    {
        summary: Type.String(),
        query: Type.String(),
        sourceCount: Type.Number(),
        model: Type.String()
    },
    { additionalProperties: false }
);

type SearchResult = Static<typeof searchResultSchema>;

const searchReturns: ToolResultContract<SearchResult> = {
    schema: searchResultSchema,
    toLLMText: (result) => result.summary
};

type GeminiResponse = {
    candidates?: Array<{
        content?: {
            parts?: Array<{
                text?: string;
            }>;
        };
        groundingMetadata?: {
            groundingChunks?: Array<{
                web?: {
                    uri?: string;
                    title?: string;
                };
            }>;
            webSearchQueries?: string[];
        };
    }>;
    error?: {
        message?: string;
    };
};

async function validateApiKey(apiKey: string): Promise<void> {
    const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": apiKey
            },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [{ text: "Test request." }]
                    }
                ],
                tools: [{ google_search: {} }]
            })
        }
    );

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini validation failed: ${response.status} - ${errorText}`);
    }

    const data = (await response.json()) as GeminiResponse;
    if (data.error?.message) {
        throw new Error(`Gemini validation failed: ${data.error.message}`);
    }
}

export const plugin = definePlugin({
    settingsSchema,
    onboarding: async (api) => {
        const instanceKey = await api.auth.getApiKey(api.instanceId);
        if (instanceKey) {
            try {
                await validateApiKey(instanceKey);
                api.note("Using existing Google instance credentials.", "Setup");
                return { settings: {} };
            } catch (error) {
                api.note("Existing Google instance key failed validation, prompting for a new key.", "Setup");
            }
        }

        // Reuses existing Google provider credentials
        const providerKey = await api.auth.getApiKey("google");
        if (providerKey) {
            try {
                await validateApiKey(providerKey);
                api.note("Using existing Google provider credentials.", "Setup");
                return { settings: {} };
            } catch (error) {
                api.note("Existing Google provider key failed validation, prompting for a new key.", "Setup");
            }
        }

        // Fallback: prompt for API key if Google provider not configured or invalid
        const apiKey = await api.prompt.input({
            message: "Google AI API key (or configure 'google' provider first)"
        });
        if (!apiKey) {
            return null;
        }
        await validateApiKey(apiKey);
        await api.auth.setApiKey(api.instanceId, apiKey);
        return { settings: {} };
    },
    create: (api) => {
        const toolName = api.settings.toolName ?? "gemini_search";
        const model = api.settings.model ?? "gemini-2.0-flash";
        const instanceId = api.instance.instanceId;

        return {
            load: async () => {
                api.registrar.registerTool({
                    tool: {
                        name: toolName,
                        description:
                            "Search the web using Google Gemini with Search Grounding. Returns AI-generated answer with source citations.",
                        parameters: searchSchema
                    },
                    returns: searchReturns,
                    execute: async (args, toolContext, toolCall) => {
                        if (!toolContext.permissions.network) {
                            throw new Error("Network access not granted. Request @network permission.");
                        }
                        const payload = args as SearchArgs;

                        // Try plugin-specific key first, fallback to Google provider key
                        let apiKey = await api.auth.getApiKey(instanceId);
                        if (!apiKey) {
                            apiKey = await api.auth.getApiKey("google");
                        }
                        if (!apiKey) {
                            throw new Error("Missing API key. Configure 'google' provider or run plugin onboarding.");
                        }

                        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

                        const response = await fetch(url, {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                "x-goog-api-key": apiKey
                            },
                            body: JSON.stringify({
                                contents: [
                                    {
                                        parts: [{ text: payload.query }]
                                    }
                                ],
                                tools: [{ google_search: {} }]
                            })
                        });

                        if (!response.ok) {
                            const errorText = await response.text();
                            throw new Error(`Gemini search failed: ${response.status} - ${errorText}`);
                        }

                        const data = (await response.json()) as GeminiResponse;

                        if (data.error) {
                            throw new Error(`Gemini search failed: ${data.error.message}`);
                        }

                        const candidate = data.candidates?.[0];
                        const content = candidate?.content?.parts?.map((p) => p.text).join("") ?? "No results found.";

                        // Extract grounding sources
                        const groundingChunks = candidate?.groundingMetadata?.groundingChunks ?? [];
                        const sources = groundingChunks
                            .filter((chunk) => chunk.web?.uri)
                            .map((chunk, i) => `${i + 1}. ${chunk.web?.title ?? "Source"}: ${chunk.web?.uri}`)
                            .join("\n");

                        let text = content;
                        if (sources) {
                            text += "\n\nSources:\n" + sources;
                        }

                        const summary = text;
                        const toolMessage: ToolResultMessage = {
                            role: "toolResult",
                            toolCallId: toolCall.id,
                            toolName: toolCall.name,
                            content: [{ type: "text", text: summary }],
                            details: { sourcesCount: groundingChunks.length },
                            isError: false,
                            timestamp: Date.now()
                        };

                        return {
                            toolMessage,
                            typedResult: {
                                summary,
                                query: payload.query,
                                sourceCount: groundingChunks.length,
                                model
                            }
                        };
                    }
                });
            },
            unload: async () => {
                api.registrar.unregisterTool(toolName);
            }
        };
    }
});
