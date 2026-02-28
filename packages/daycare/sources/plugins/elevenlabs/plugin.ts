import path from "node:path";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import type {
    AllowedOutputFormats,
    BodyAudioIsolationV1AudioIsolationPost,
    BodyComposeMusicV1MusicPost,
    BodyTextToSpeechFull,
    CreateSoundEffectRequest,
    TextToSpeechConvertRequestOutputFormat
} from "@elevenlabs/elevenlabs-js/api";
import {
    AllowedOutputFormats as mediaOutputFormats,
    TextToSpeechConvertRequestOutputFormat as textToSpeechOutputFormats
} from "@elevenlabs/elevenlabs-js/api";
import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";
import { z } from "zod";
import type { ToolDefinition, ToolExecutionContext, ToolResultContract } from "@/types";
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
const SPEECH_OUTPUT_FORMAT_ALIASES: Record<string, TextToSpeechConvertRequestOutputFormat> = {
    mp3: "mp3_44100_128",
    mpeg: "mp3_44100_128",
    wav: "wav_44100"
};
const SPEECH_OUTPUT_FORMATS_SUPPORTED = new Set<string>(Object.values(textToSpeechOutputFormats));
const MEDIA_OUTPUT_FORMAT_ALIASES: Record<string, AllowedOutputFormats> = {
    mp3: "mp3_44100_128",
    mpeg: "mp3_44100_128"
};
const MEDIA_OUTPUT_FORMATS_SUPPORTED = new Set<string>(Object.values(mediaOutputFormats));

const ELEVENLABS_MUSIC_TOOL = "elevenlabs_generate_music";
const ELEVENLABS_SOUND_EFFECTS_TOOL = "elevenlabs_generate_sound_effects";
const ELEVENLABS_VOICE_ISOLATOR_TOOL = "elevenlabs_voice_isolator";
const DEFAULT_MEDIA_OUTPUT_FORMAT: AllowedOutputFormats = "mp3_44100_128";
const DEFAULT_MUSIC_MODEL: BodyComposeMusicV1MusicPost["modelId"] = "music_v1";

const musicToolSchema = Type.Object(
    {
        prompt: Type.String({ minLength: 1 }),
        duration_seconds: Type.Optional(Type.Number({ minimum: 3, maximum: 600 })),
        output_format: Type.Optional(Type.String({ minLength: 1 })),
        force_instrumental: Type.Optional(Type.Boolean()),
        seed: Type.Optional(Type.Integer({ minimum: 0 }))
    },
    { additionalProperties: false }
);

type MusicToolArgs = Static<typeof musicToolSchema>;

const soundEffectsToolSchema = Type.Object(
    {
        prompt: Type.String({ minLength: 1 }),
        duration_seconds: Type.Optional(Type.Number({ minimum: 0.5, maximum: 30 })),
        loop: Type.Optional(Type.Boolean()),
        prompt_influence: Type.Optional(Type.Number({ minimum: 0, maximum: 1 })),
        output_format: Type.Optional(Type.String({ minLength: 1 })),
        model: Type.Optional(Type.String({ minLength: 1 }))
    },
    { additionalProperties: false }
);

type SoundEffectsToolArgs = Static<typeof soundEffectsToolSchema>;

const voiceIsolatorToolSchema = Type.Object(
    {
        path: Type.String({ minLength: 1 }),
        file_format: Type.Optional(Type.Union([Type.Literal("pcm_s16le_16"), Type.Literal("other")])),
        input_mime_type: Type.Optional(Type.String({ minLength: 1 }))
    },
    { additionalProperties: false }
);

type VoiceIsolatorToolArgs = Static<typeof voiceIsolatorToolSchema>;

const audioToolResultSchema = Type.Object(
    {
        summary: Type.String(),
        filePath: Type.String(),
        fileName: Type.String(),
        mimeType: Type.String(),
        size: Type.Number()
    },
    { additionalProperties: false }
);

type AudioToolResult = Static<typeof audioToolResultSchema>;

const audioToolReturns: ToolResultContract<AudioToolResult> = {
    schema: audioToolResultSchema,
    toLLMText: (result) => result.summary
};

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
                api.registrar.registerTool(elevenlabsToolMusic(authId));
                api.registrar.registerTool(elevenlabsToolSoundEffects(authId));
                api.registrar.registerTool(elevenlabsToolVoiceIsolator(authId));
            },
            unload: async () => {
                api.registrar.unregisterSpeechProvider(providerId);
                api.registrar.unregisterTool(ELEVENLABS_MUSIC_TOOL);
                api.registrar.unregisterTool(ELEVENLABS_SOUND_EFFECTS_TOOL);
                api.registrar.unregisterTool(ELEVENLABS_VOICE_ISOLATOR_TOOL);
            }
        };
    }
});

function elevenlabsToolMusic(authId: string): ToolDefinition {
    return {
        tool: {
            name: ELEVENLABS_MUSIC_TOOL,
            description: "Generate music from a text prompt with ElevenLabs.",
            parameters: musicToolSchema
        },
        returns: audioToolReturns,
        execute: async (args, context, toolCall) => {
            const payload = args as MusicToolArgs;
            const apiKey = await elevenlabsApiKeyResolve(context, authId);
            const client = new ElevenLabsClient({ apiKey });
            const outputFormat =
                payload.output_format !== undefined
                    ? mediaOutputFormatResolve(payload.output_format)
                    : DEFAULT_MEDIA_OUTPUT_FORMAT;

            const request: BodyComposeMusicV1MusicPost = {
                prompt: payload.prompt,
                outputFormat,
                musicLengthMs:
                    payload.duration_seconds !== undefined ? Math.round(payload.duration_seconds * 1000) : undefined,
                forceInstrumental: payload.force_instrumental,
                seed: payload.seed,
                modelId: DEFAULT_MUSIC_MODEL
            };

            const response = await client.music.compose(request).withRawResponse();
            const contentType = speechContentTypeResolve(response.rawResponse.headers);
            const mimeType = speechMimeTypeResolve(outputFormat, contentType);
            const saved = await elevenlabsToolAudioSave(context, "elevenlabs-music", mimeType, response.data);

            return elevenlabsToolAudioResult(toolCall, `Generated music file ${saved.filePath}.`, saved);
        }
    };
}

function elevenlabsToolSoundEffects(authId: string): ToolDefinition {
    return {
        tool: {
            name: ELEVENLABS_SOUND_EFFECTS_TOOL,
            description: "Generate a sound effect from a text prompt with ElevenLabs.",
            parameters: soundEffectsToolSchema
        },
        returns: audioToolReturns,
        execute: async (args, context, toolCall) => {
            const payload = args as SoundEffectsToolArgs;
            const apiKey = await elevenlabsApiKeyResolve(context, authId);
            const client = new ElevenLabsClient({ apiKey });
            const outputFormat =
                payload.output_format !== undefined
                    ? mediaOutputFormatResolve(payload.output_format)
                    : DEFAULT_MEDIA_OUTPUT_FORMAT;

            const request: CreateSoundEffectRequest = {
                text: payload.prompt,
                outputFormat,
                durationSeconds: payload.duration_seconds,
                loop: payload.loop,
                promptInfluence: payload.prompt_influence,
                modelId: payload.model
            };

            const response = await client.textToSoundEffects.convert(request).withRawResponse();
            const contentType = speechContentTypeResolve(response.rawResponse.headers);
            const mimeType = speechMimeTypeResolve(outputFormat, contentType);
            const saved = await elevenlabsToolAudioSave(context, "elevenlabs-sfx", mimeType, response.data);

            return elevenlabsToolAudioResult(toolCall, `Generated sound effect file ${saved.filePath}.`, saved);
        }
    };
}

function elevenlabsToolVoiceIsolator(authId: string): ToolDefinition {
    return {
        tool: {
            name: ELEVENLABS_VOICE_ISOLATOR_TOOL,
            description: "Isolate voice from an input audio file using ElevenLabs audio isolation.",
            parameters: voiceIsolatorToolSchema
        },
        returns: audioToolReturns,
        execute: async (args, context, toolCall) => {
            const payload = args as VoiceIsolatorToolArgs;
            const apiKey = await elevenlabsApiKeyResolve(context, authId);
            const client = new ElevenLabsClient({ apiKey });
            const read = await context.sandbox.read({
                path: payload.path,
                binary: true
            });
            if (read.type !== "binary") {
                throw new Error("Input path must point to an audio file.");
            }

            const request: BodyAudioIsolationV1AudioIsolationPost = {
                audio: {
                    data: read.content,
                    filename: path.basename(read.displayPath),
                    contentType: payload.input_mime_type
                },
                fileFormat: payload.file_format
            };

            const response = await client.audioIsolation.convert(request).withRawResponse();
            const contentType = speechContentTypeResolve(response.rawResponse.headers);
            const mimeType = speechMimeTypeResolve(DEFAULT_MEDIA_OUTPUT_FORMAT, contentType);
            const saved = await elevenlabsToolAudioSave(context, "elevenlabs-voice-isolated", mimeType, response.data);

            return elevenlabsToolAudioResult(toolCall, `Generated isolated voice file ${saved.filePath}.`, saved);
        }
    };
}

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
    const outputFormat = speechOutputFormatResolve(
        request.outputFormat ?? settings.outputFormat ?? DEFAULT_OUTPUT_FORMAT
    );
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

async function elevenlabsApiKeyResolve(
    context: ToolExecutionContext | SpeechGenerationContext,
    authId: string
): Promise<string> {
    const apiKey = await context.auth.getApiKey(authId);
    if (!apiKey) {
        throw new Error("Missing elevenlabs apiKey in auth store");
    }
    return apiKey;
}

function mediaOutputFormatResolve(outputFormat: string): AllowedOutputFormats {
    const normalized = outputFormat.trim().toLowerCase();
    if (normalized.length === 0) {
        throw new Error("Output format must be a non-empty string");
    }

    const alias = MEDIA_OUTPUT_FORMAT_ALIASES[normalized];
    if (alias) {
        return alias;
    }

    if (MEDIA_OUTPUT_FORMATS_SUPPORTED.has(normalized)) {
        return normalized as AllowedOutputFormats;
    }

    throw new Error(
        `Unsupported ElevenLabs output format: ${outputFormat}. ` +
            "Use mp3/mpeg shorthand or explicit values like mp3_44100_128."
    );
}

function speechOutputFormatResolve(outputFormat: string): TextToSpeechConvertRequestOutputFormat {
    const normalized = outputFormat.trim().toLowerCase();
    if (normalized.length === 0) {
        throw new Error("Output format must be a non-empty string");
    }

    const alias = SPEECH_OUTPUT_FORMAT_ALIASES[normalized];
    if (alias) {
        return alias;
    }

    if (SPEECH_OUTPUT_FORMATS_SUPPORTED.has(normalized)) {
        return normalized as TextToSpeechConvertRequestOutputFormat;
    }

    throw new Error(
        `Unsupported ElevenLabs output format: ${outputFormat}. ` +
            "Use mp3/mpeg/wav shorthand or explicit values like mp3_44100_128."
    );
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

async function elevenlabsToolAudioSave(
    context: ToolExecutionContext,
    filePrefix: string,
    mimeType: string,
    stream: ReadableStream<Uint8Array>
): Promise<{ filePath: string; fileName: string; mimeType: string; size: number }> {
    const extension = speechExtensionResolve(mimeType);
    const fileName = `${filePrefix}-${Date.now()}${extension}`;
    const data = await speechBufferFromReadable(stream);
    const saved = await context.sandbox.write({
        path: `~/downloads/${fileName}`,
        content: data
    });
    return {
        filePath: saved.sandboxPath,
        fileName,
        mimeType,
        size: saved.bytes
    };
}

function elevenlabsToolAudioResult(
    toolCall: { id: string; name: string },
    summary: string,
    saved: { filePath: string; fileName: string; mimeType: string; size: number }
): { toolMessage: ToolResultMessage; typedResult: AudioToolResult } {
    const toolMessage: ToolResultMessage = {
        role: "toolResult",
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        content: [{ type: "text", text: summary }],
        details: {
            filePath: saved.filePath,
            fileName: saved.fileName,
            mimeType: saved.mimeType,
            size: saved.size
        },
        isError: false,
        timestamp: Date.now()
    };

    return {
        toolMessage,
        typedResult: {
            summary,
            filePath: saved.filePath,
            fileName: saved.fileName,
            mimeType: saved.mimeType,
            size: saved.size
        }
    };
}

function speechErrorMessageResolve(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}
