import { promises as fs } from "node:fs";
import { z } from "zod";
import type { MediaType } from "@/types";
import { definePlugin } from "../../engine/plugins/types.js";

const DEFAULT_MODEL = "gemini-3-flash-preview";
const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;
const DEFAULT_REQUEST_TIMEOUT_MS = 60_000;

const mediaTypeSchema = z.enum(["image", "video", "audio", "pdf"]);

const settingsSchema = z
    .object({
        model: z.string().min(1).optional(),
        baseUrl: z.string().min(1).optional(),
        providerId: z.string().min(1).optional(),
        label: z.string().min(1).optional(),
        authId: z.string().min(1).optional(),
        supportedTypes: z.array(mediaTypeSchema).nonempty().optional(),
        maxFileSizeBytes: z.number().int().positive().optional(),
        requestTimeoutMs: z.number().int().positive().optional()
    })
    .passthrough();

type MediaAnalysisSettings = z.infer<typeof settingsSchema>;

type GeminiGenerateContentResponse = {
    candidates?: Array<{
        content?: {
            parts?: Array<{
                text?: string;
            }>;
        };
    }>;
};

const supportedTypesDefault: MediaType[] = ["image", "video", "audio", "pdf"];

export const plugin = definePlugin({
    settingsSchema,
    onboarding: async (api) => {
        const existingKey = await api.auth.getApiKey("google");
        if (!existingKey) {
            const apiKey = await api.prompt.input({
                message: "Google AI API key (or configure 'google' provider first)"
            });
            if (!apiKey) {
                return null;
            }
            await api.auth.setApiKey("google", apiKey);
        }

        return {
            settings: {}
        };
    },
    create: (api) => {
        const settings = api.settings as MediaAnalysisSettings;
        const providerId = settings.providerId ?? api.instance.pluginId;
        const label = settings.label ?? providerId;
        const authId = settings.authId ?? "google";
        const supportedTypes = settings.supportedTypes ?? supportedTypesDefault;
        const maxFileSizeBytes = settings.maxFileSizeBytes ?? DEFAULT_MAX_FILE_SIZE_BYTES;
        const requestTimeoutMs = settings.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;

        return {
            load: async () => {
                api.registrar.registerMediaAnalysisProvider({
                    id: providerId,
                    label,
                    supportedTypes,
                    analyze: async (request, mediaContext) => {
                        const apiKey = await mediaContext.auth.getApiKey(authId);
                        if (!apiKey) {
                            throw new Error("Missing gemini-media apiKey in auth store");
                        }

                        const model = request.model ?? settings.model ?? DEFAULT_MODEL;
                        const baseUrl = (settings.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
                        const endpoint = `${baseUrl}/models/${model}:generateContent`;
                        const stats = await fs.stat(request.filePath);
                        if (stats.size > maxFileSizeBytes) {
                            throw new Error(
                                `Media file too large (${stats.size} bytes). Limit is ${maxFileSizeBytes} bytes for inline analysis.`
                            );
                        }
                        const bytes = await fs.readFile(request.filePath);
                        const inlineMimeType = request.mediaType === "pdf" ? "application/pdf" : request.mimeType;
                        const abortController = new AbortController();
                        const timeout = setTimeout(() => {
                            abortController.abort();
                        }, requestTimeoutMs);
                        let response: Response;
                        try {
                            response = await fetch(endpoint, {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json",
                                    "x-goog-api-key": apiKey
                                },
                                body: JSON.stringify({
                                    contents: [
                                        {
                                            parts: [
                                                { text: request.prompt },
                                                {
                                                    inlineData: {
                                                        mimeType: inlineMimeType,
                                                        data: bytes.toString("base64")
                                                    }
                                                }
                                            ]
                                        }
                                    ]
                                }),
                                signal: abortController.signal
                            });
                        } catch (error) {
                            if (abortController.signal.aborted) {
                                throw new Error(`Gemini media analysis timed out after ${requestTimeoutMs}ms`);
                            }
                            throw error;
                        } finally {
                            clearTimeout(timeout);
                        }

                        if (!response.ok) {
                            const errorText = await response.text();
                            throw new Error(`Gemini media analysis failed: ${response.status} - ${errorText}`);
                        }

                        const data = (await response.json()) as GeminiGenerateContentResponse;
                        const text = geminiTextExtract(data);
                        if (!text) {
                            throw new Error("Gemini media analysis returned no text content");
                        }
                        return { text };
                    }
                });
            },
            unload: async () => {
                api.registrar.unregisterMediaAnalysisProvider(providerId);
            }
        };
    }
});

function geminiTextExtract(response: GeminiGenerateContentResponse): string {
    const parts = response.candidates?.[0]?.content?.parts ?? [];
    return parts
        .map((part) => part.text ?? "")
        .join("")
        .trim();
}
