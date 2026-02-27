import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import type { BodyTextToSpeechFull, TextToSpeechConvertRequestOutputFormat } from "@elevenlabs/elevenlabs-js/api";
import { z } from "zod";
import type {
    SpeechGenerationContext,
    SpeechGenerationRequest,
    SpeechGenerationResult,
    SpeechVoice
} from "../../engine/modules/speech/types.js";
import { definePlugin } from "../../engine/plugins/types.js";
import { type ElevenLabsVoiceCatalogEntry, elevenLabsVoiceCatalogDefault } from "./voiceCatalog.js";

const DEFAULT_MODEL = "eleven_multilingual_v2";
const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";
const DEFAULT_OUTPUT_FORMAT = "mp3_44100_128";

const settingsSchema = z
    .object({
        model: z.string().min(1).optional(),
        voice: z.string().min(1).optional(),
        outputFormat: z.string().min(1).optional(),
        providerId: z.string().min(1).optional(),
        label: z.string().min(1).optional(),
        authId: z.string().min(1).optional(),
        voices: z
            .array(
                z.object({
                    id: z.string().min(1),
                    description: z.string().min(1)
                })
            )
            .nonempty()
            .optional()
    })
    .passthrough();

type ElevenLabsSettings = z.infer<typeof settingsSchema>;

export const plugin = definePlugin({
    settingsSchema,
    onboarding: async (api) => {
        const authId = "elevenlabs";
        const existingKey = await api.auth.getApiKey(authId);
        if (existingKey) {
            api.note("Using existing ElevenLabs credentials.", "Setup");
            return { settings: {} };
        }

        const apiKey = await api.prompt.input({
            message: "ElevenLabs API key"
        });
        if (!apiKey) {
            return null;
        }

        await api.auth.setApiKey(authId, apiKey);
        return { settings: {} };
    },
    create: (api) => {
        const settings = api.settings as ElevenLabsSettings;
        const providerId = settings.providerId ?? api.instance.pluginId;
        const label = settings.label ?? providerId;
        const authId = settings.authId ?? "elevenlabs";
        const voiceCatalog = speechVoiceCatalogResolve(settings);

        return {
            load: async () => {
                api.registrar.registerSpeechProvider({
                    id: providerId,
                    label,
                    generate: async (request, context) => {
                        return speechGenerate(request, context, settings, authId, voiceCatalog);
                    },
                    listVoices: async () => {
                        return speechVoicesList(voiceCatalog);
                    }
                });
            },
            unload: async () => {
                api.registrar.unregisterSpeechProvider(providerId);
            }
        };
    }
});

async function speechGenerate(
    request: SpeechGenerationRequest,
    context: SpeechGenerationContext,
    settings: ElevenLabsSettings,
    authId: string,
    voiceCatalog: ElevenLabsVoiceCatalogEntry[]
): Promise<SpeechGenerationResult> {
    const apiKey = await context.auth.getApiKey(authId);
    if (!apiKey) {
        throw new Error("Missing elevenlabs apiKey in auth store");
    }

    const model = request.model ?? settings.model ?? DEFAULT_MODEL;
    const voice = request.voice ?? settings.voice ?? DEFAULT_VOICE_ID;
    const outputFormat = request.outputFormat ?? settings.outputFormat ?? DEFAULT_OUTPUT_FORMAT;
    const voiceId = speechVoiceIdResolve(voice, voiceCatalog);
    const client = new ElevenLabsClient({ apiKey });

    const payload: BodyTextToSpeechFull = {
        text: request.text,
        modelId: model,
        outputFormat: outputFormat as TextToSpeechConvertRequestOutputFormat,
        languageCode: request.language,
        voiceSettings: request.speed !== undefined ? { speed: request.speed } : undefined
    };

    let data: Buffer;
    let contentType: string | null = null;
    try {
        const response = await client.textToSpeech.convert(voiceId, payload).withRawResponse();
        data = await speechBufferFromReadable(response.data);
        contentType = speechContentTypeResolve(response.rawResponse.headers);
    } catch (error) {
        throw new Error(`ElevenLabs speech generation failed: ${speechErrorMessageResolve(error)}`);
    }

    const mimeType = speechMimeTypeResolve(outputFormat, contentType);
    const extension = speechExtensionResolve(mimeType);
    const stored = await context.fileStore.saveBuffer({
        name: `elevenlabs-${Date.now()}${extension}`,
        mimeType,
        data
    });

    return {
        files: [
            {
                id: stored.id,
                name: stored.name,
                mimeType: stored.mimeType,
                size: stored.size,
                path: stored.path
            }
        ]
    };
}

function speechVoicesList(voiceCatalog: ElevenLabsVoiceCatalogEntry[]): Promise<SpeechVoice[]> {
    return Promise.resolve(
        voiceCatalog.map((voice) => ({
            id: voice.id,
            description: voice.description
        }))
    );
}

function speechVoiceIdResolve(voice: string, voiceCatalog: ElevenLabsVoiceCatalogEntry[]): string {
    const value = voice.trim();
    if (value.length === 0) {
        throw new Error("Voice must be a non-empty string");
    }

    const targetLower = value.toLowerCase();
    for (const entry of voiceCatalog) {
        if (entry.id === value) {
            return entry.id;
        }
    }
    for (const entry of voiceCatalog) {
        if (entry.description.toLowerCase() === targetLower) {
            return entry.id;
        }
    }
    return value;
}

function speechVoiceCatalogResolve(settings: ElevenLabsSettings): ElevenLabsVoiceCatalogEntry[] {
    return settings.voices ?? elevenLabsVoiceCatalogDefault;
}

function speechMimeTypeResolve(outputFormat: string, contentType: string | null): string {
    const normalizedType = contentType?.trim().toLowerCase() ?? "";
    if (normalizedType.startsWith("audio/")) {
        return normalizedType.split(";")[0] ?? "audio/mpeg";
    }

    const normalizedFormat = outputFormat.trim().toLowerCase();
    if (normalizedFormat.startsWith("mp3")) {
        return "audio/mpeg";
    }
    if (
        normalizedFormat.startsWith("wav") ||
        normalizedFormat.startsWith("pcm") ||
        normalizedFormat.startsWith("ulaw")
    ) {
        return "audio/wav";
    }
    if (normalizedFormat.startsWith("ogg")) {
        return "audio/ogg";
    }
    if (normalizedFormat.startsWith("opus")) {
        return "audio/opus";
    }
    if (normalizedFormat.startsWith("aac")) {
        return "audio/aac";
    }
    if (normalizedFormat.startsWith("flac")) {
        return "audio/flac";
    }

    return "audio/mpeg";
}

function speechExtensionResolve(mimeType: string): string {
    const normalized = mimeType.trim().toLowerCase();
    if (normalized === "audio/mpeg" || normalized === "audio/mp3") {
        return ".mp3";
    }
    if (normalized === "audio/wav" || normalized === "audio/x-wav" || normalized === "audio/wave") {
        return ".wav";
    }
    if (normalized === "audio/ogg") {
        return ".ogg";
    }
    if (normalized === "audio/opus") {
        return ".opus";
    }
    if (normalized === "audio/aac") {
        return ".aac";
    }
    if (normalized === "audio/flac") {
        return ".flac";
    }
    if (normalized === "audio/webm") {
        return ".webm";
    }
    if (normalized === "audio/mp4" || normalized === "audio/x-m4a") {
        return ".m4a";
    }
    return ".mp3";
}

function speechContentTypeResolve(headers: unknown): string | null {
    if (headers && typeof headers === "object" && "get" in headers && typeof headers.get === "function") {
        const value = headers.get("content-type");
        return typeof value === "string" ? value : null;
    }
    return null;
}

async function speechBufferFromReadable(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
    const reader = stream.getReader();
    const chunks: Buffer[] = [];
    while (true) {
        const chunk = await reader.read();
        if (chunk.done) {
            break;
        }
        if (chunk.value) {
            chunks.push(Buffer.from(chunk.value));
        }
    }
    return Buffer.concat(chunks);
}

function speechErrorMessageResolve(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}
