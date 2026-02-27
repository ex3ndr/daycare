import { z } from "zod";
import type {
    SpeechGenerationContext,
    SpeechGenerationRequest,
    SpeechGenerationResult,
    SpeechVoice
} from "../../engine/modules/speech/types.js";
import { definePlugin } from "../../engine/plugins/types.js";

const DEFAULT_MODEL = "eleven_multilingual_v2";
const DEFAULT_VOICE = "Rachel";
const DEFAULT_OUTPUT_FORMAT = "mp3_44100_128";
const DEFAULT_BASE_URL = "https://api.elevenlabs.io";

const settingsSchema = z
    .object({
        model: z.string().min(1).optional(),
        voice: z.string().min(1).optional(),
        outputFormat: z.string().min(1).optional(),
        providerId: z.string().min(1).optional(),
        label: z.string().min(1).optional(),
        authId: z.string().min(1).optional()
    })
    .passthrough();

type ElevenLabsSettings = z.infer<typeof settingsSchema>;

type ElevenLabsVoiceRecord = {
    voice_id?: string;
    name?: string;
    preview_url?: string;
    labels?: {
        language?: string;
    };
};

type ElevenLabsVoicesResponse = {
    voices?: ElevenLabsVoiceRecord[];
};

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

        return {
            load: async () => {
                api.registrar.registerSpeechProvider({
                    id: providerId,
                    label,
                    generate: async (request, context) => {
                        return speechGenerate(request, context, settings, authId);
                    },
                    listVoices: async (context) => {
                        return speechVoicesList(context, authId);
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
    authId: string
): Promise<SpeechGenerationResult> {
    const apiKey = await context.auth.getApiKey(authId);
    if (!apiKey) {
        throw new Error("Missing elevenlabs apiKey in auth store");
    }

    const model = request.model ?? settings.model ?? DEFAULT_MODEL;
    const voice = request.voice ?? settings.voice ?? DEFAULT_VOICE;
    const outputFormat = request.outputFormat ?? settings.outputFormat ?? DEFAULT_OUTPUT_FORMAT;
    const voiceId = await speechVoiceIdResolve(voice, apiKey);

    const payload: Record<string, unknown> = {
        text: request.text,
        model_id: model
    };
    if (request.language) {
        payload.language_code = request.language;
    }
    if (request.speed !== undefined) {
        payload.voice_settings = {
            speed: request.speed
        };
    }

    const endpoint = `${DEFAULT_BASE_URL}/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${encodeURIComponent(outputFormat)}`;
    const response = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "xi-api-key": apiKey
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs speech generation failed: ${response.status} - ${errorText}`);
    }

    const data = Buffer.from(await response.arrayBuffer());
    const mimeType = speechMimeTypeResolve(outputFormat, response.headers.get("content-type"));
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

async function speechVoicesList(context: SpeechGenerationContext, authId: string): Promise<SpeechVoice[]> {
    const apiKey = await context.auth.getApiKey(authId);
    if (!apiKey) {
        throw new Error("Missing elevenlabs apiKey in auth store");
    }

    const voices = await speechVoicesFetch(apiKey);
    const mapped: SpeechVoice[] = [];
    for (const voice of voices) {
        const id = voice.voice_id?.trim() ?? "";
        const name = voice.name?.trim() ?? "";
        if (id.length === 0 || name.length === 0) {
            continue;
        }
        const language = voice.labels?.language?.trim() || undefined;
        const preview = voice.preview_url?.trim() || undefined;
        mapped.push({
            id,
            name,
            language,
            preview
        });
    }
    return mapped;
}

async function speechVoiceIdResolve(voice: string, apiKey: string): Promise<string> {
    const value = voice.trim();
    if (value.length === 0) {
        throw new Error("Voice must be a non-empty string");
    }

    const voices = await speechVoicesFetch(apiKey);
    const targetLower = value.toLowerCase();
    for (const entry of voices) {
        if (entry.voice_id?.trim() === value) {
            return entry.voice_id;
        }
    }
    for (const entry of voices) {
        const entryName = entry.name?.trim().toLowerCase();
        if (entryName && entryName === targetLower && entry.voice_id?.trim()) {
            return entry.voice_id;
        }
    }

    throw new Error(`ElevenLabs voice not found: ${voice}`);
}

async function speechVoicesFetch(apiKey: string): Promise<ElevenLabsVoiceRecord[]> {
    const response = await fetch(`${DEFAULT_BASE_URL}/v1/voices`, {
        method: "GET",
        headers: {
            "xi-api-key": apiKey
        }
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs voices request failed: ${response.status} - ${errorText}`);
    }
    const data = (await response.json()) as ElevenLabsVoicesResponse;
    return data.voices ?? [];
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
