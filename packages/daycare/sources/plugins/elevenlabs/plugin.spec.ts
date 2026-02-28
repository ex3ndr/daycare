import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PluginApi, SpeechGenerationProvider } from "@/types";
import { AuthStore } from "../../auth/store.js";
import { configResolve } from "../../config/configResolve.js";
import { FileFolder } from "../../engine/files/fileFolder.js";
import type { PluginRegistrar } from "../../engine/plugins/registry.js";
import { Processes } from "../../engine/processes/processes.js";
import { getLogger } from "../../log.js";
import { storageOpenTest } from "../../storage/storageOpenTest.js";
import { plugin as elevenLabs } from "./plugin.js";

const { convertMock, composeMock, soundEffectsConvertMock, audioIsolationConvertMock, elevenLabsClientMock } =
    vi.hoisted(() => {
        const convert = vi.fn();
        const compose = vi.fn();
        const soundEffectsConvert = vi.fn();
        const audioIsolationConvert = vi.fn();
        const client = vi.fn(() => ({
            textToSpeech: {
                convert
            },
            music: {
                compose
            },
            textToSoundEffects: {
                convert: soundEffectsConvert
            },
            audioIsolation: {
                convert: audioIsolationConvert
            }
        }));
        return {
            convertMock: convert,
            composeMock: compose,
            soundEffectsConvertMock: soundEffectsConvert,
            audioIsolationConvertMock: audioIsolationConvert,
            elevenLabsClientMock: client
        };
    });

vi.mock("@elevenlabs/elevenlabs-js", () => ({
    ElevenLabsClient: elevenLabsClientMock
}));

describe("elevenlabs plugin", () => {
    const tempDirs: string[] = [];

    afterEach(async () => {
        vi.restoreAllMocks();
        convertMock.mockReset();
        composeMock.mockReset();
        soundEffectsConvertMock.mockReset();
        audioIsolationConvertMock.mockReset();
        elevenLabsClientMock.mockClear();
        vi.unstubAllGlobals();
        for (const dir of tempDirs.splice(0, tempDirs.length)) {
            await fs.rm(dir, { recursive: true, force: true });
        }
    });

    it("registers speech provider, lists voices, and generates speech", async () => {
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-elevenlabs-"));
        tempDirs.push(dir);

        const config = configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"));
        const auth = new AuthStore(config);
        await auth.setApiKey("elevenlabs", "test-elevenlabs-key");
        const storage = await storageOpenTest();

        const registrationState: {
            provider: SpeechGenerationProvider | null;
            unregisteredProviderId: string | null;
        } = {
            provider: null,
            unregisteredProviderId: null
        };

        const registrar = {
            registerSpeechProvider: (provider: SpeechGenerationProvider) => {
                registrationState.provider = provider;
            },
            unregisterSpeechProvider: (id: string) => {
                registrationState.unregisteredProviderId = id;
            },
            registerMediaAnalysisProvider: () => undefined,
            unregisterMediaAnalysisProvider: () => undefined,
            registerInferenceProvider: () => undefined,
            unregisterInferenceProvider: () => undefined,
            registerTool: () => undefined,
            unregisterTool: () => undefined,
            registerImageProvider: () => undefined,
            unregisterImageProvider: () => undefined,
            registerConnector: () => undefined,
            unregisterConnector: async () => undefined
        } as unknown as PluginRegistrar;

        const withRawResponseMock = vi.fn(async () => ({
            data: speechReadableFromText("audio-bytes"),
            rawResponse: {
                headers: new Headers({
                    "content-type": "audio/mpeg"
                })
            }
        }));
        convertMock.mockReturnValue({
            withRawResponse: withRawResponseMock
        });

        const settings = elevenLabs.settingsSchema.parse({});
        const api: PluginApi<typeof settings> = {
            instance: { instanceId: "elevenlabs-main", pluginId: "elevenlabs", enabled: true },
            settings,
            engineSettings: {},
            logger: getLogger("test.elevenlabs"),
            auth,
            dataDir: dir,
            tmpDir: path.join(dir, "tmp"),
            usersDir: path.join(dir, "users"),
            registrar,
            exposes: {
                registerProvider: async () => undefined,
                unregisterProvider: async () => undefined,
                listProviders: () => []
            },
            fileStore: new FileFolder(path.join(config.dataDir, "files")),
            inference: {
                complete: async () => {
                    throw new Error("Inference not available in tests");
                }
            },
            processes: new Processes(dir, getLogger("test.processes.elevenlabs"), {
                repository: storage.processes
            }),
            mode: "runtime",
            events: {
                emit: () => undefined
            }
        };

        const instance = await elevenLabs.create(api);
        await instance.load?.();

        if (!registrationState.provider) {
            throw new Error("Speech provider was not registered");
        }

        const voices = await registrationState.provider.listVoices?.({
            auth,
            fileStore: api.fileStore,
            logger: getLogger("test.elevenlabs.voices")
        });
        expect(voices).toEqual([
            {
                id: "21m00Tcm4TlvDq8ikWAM",
                description: "Rachel - warm, expressive female voice suited for narration and assistants."
            },
            {
                id: "AZnzlk1XvdvUeBnXmlld",
                description: "Domi - clear female voice with energetic delivery for short-form content."
            },
            {
                id: "EXAVITQu4vr4xnSDxMaL",
                description: "Bella - friendly female voice with conversational tone."
            },
            {
                id: "ErXwobaYiN019PkySvjV",
                description: "Antoni - deep male voice for announcements and narration."
            }
        ]);

        const result = await registrationState.provider.generate(
            {
                text: "Hello from ElevenLabs"
            },
            {
                auth,
                fileStore: api.fileStore,
                logger: getLogger("test.elevenlabs.generate")
            }
        );

        expect(result.files).toHaveLength(1);
        const generated = result.files[0]!;
        const audioData = await fs.readFile(generated.path, "utf8");
        expect(audioData).toBe("audio-bytes");
        expect(generated.mimeType).toBe("audio/mpeg");
        expect(elevenLabsClientMock).toHaveBeenCalledWith({ apiKey: "test-elevenlabs-key" });
        expect(convertMock).toHaveBeenCalledWith(
            "21m00Tcm4TlvDq8ikWAM",
            expect.objectContaining({
                text: "Hello from ElevenLabs",
                modelId: "eleven_multilingual_v2",
                outputFormat: "mp3_44100_128"
            })
        );

        await instance.unload?.();
        expect(registrationState.unregisteredProviderId).toBe("elevenlabs");
    });

    it("normalizes shorthand output format aliases", async () => {
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-elevenlabs-"));
        tempDirs.push(dir);

        const config = configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"));
        const auth = new AuthStore(config);
        await auth.setApiKey("elevenlabs", "test-elevenlabs-key");
        const storage = await storageOpenTest();

        const registrationState: { provider: SpeechGenerationProvider | null } = {
            provider: null
        };

        const registrar = {
            registerSpeechProvider: (provider: SpeechGenerationProvider) => {
                registrationState.provider = provider;
            },
            unregisterSpeechProvider: () => undefined,
            registerMediaAnalysisProvider: () => undefined,
            unregisterMediaAnalysisProvider: () => undefined,
            registerInferenceProvider: () => undefined,
            unregisterInferenceProvider: () => undefined,
            registerTool: () => undefined,
            unregisterTool: () => undefined,
            registerImageProvider: () => undefined,
            unregisterImageProvider: () => undefined,
            registerConnector: () => undefined,
            unregisterConnector: async () => undefined
        } as unknown as PluginRegistrar;

        const withRawResponseMock = vi.fn(async () => ({
            data: speechReadableFromText("audio-bytes"),
            rawResponse: {
                headers: new Headers({
                    "content-type": "audio/mpeg"
                })
            }
        }));
        convertMock.mockReturnValue({
            withRawResponse: withRawResponseMock
        });

        const settings = elevenLabs.settingsSchema.parse({ outputFormat: "wav_16000" });
        const api: PluginApi<typeof settings> = {
            instance: { instanceId: "elevenlabs-main", pluginId: "elevenlabs", enabled: true },
            settings,
            engineSettings: {},
            logger: getLogger("test.elevenlabs.alias"),
            auth,
            dataDir: dir,
            tmpDir: path.join(dir, "tmp"),
            usersDir: path.join(dir, "users"),
            registrar,
            exposes: {
                registerProvider: async () => undefined,
                unregisterProvider: async () => undefined,
                listProviders: () => []
            },
            fileStore: new FileFolder(path.join(config.dataDir, "files")),
            inference: {
                complete: async () => {
                    throw new Error("Inference not available in tests");
                }
            },
            processes: new Processes(dir, getLogger("test.processes.elevenlabs.alias"), {
                repository: storage.processes
            }),
            mode: "runtime",
            events: {
                emit: () => undefined
            }
        };

        const instance = await elevenLabs.create(api);
        await instance.load?.();
        if (!registrationState.provider) {
            throw new Error("Speech provider was not registered");
        }

        await registrationState.provider.generate(
            {
                text: "Alias check",
                outputFormat: "mpeg"
            },
            {
                auth,
                fileStore: api.fileStore,
                logger: getLogger("test.elevenlabs.alias.generate")
            }
        );

        expect(convertMock).toHaveBeenCalledWith(
            "21m00Tcm4TlvDq8ikWAM",
            expect.objectContaining({
                outputFormat: "mp3_44100_128"
            })
        );
    });

    it("rejects unsupported output format values before calling api", async () => {
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-elevenlabs-"));
        tempDirs.push(dir);

        const config = configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"));
        const auth = new AuthStore(config);
        await auth.setApiKey("elevenlabs", "test-elevenlabs-key");
        const storage = await storageOpenTest();

        const registrationState: { provider: SpeechGenerationProvider | null } = {
            provider: null
        };

        const registrar = {
            registerSpeechProvider: (provider: SpeechGenerationProvider) => {
                registrationState.provider = provider;
            },
            unregisterSpeechProvider: () => undefined,
            registerMediaAnalysisProvider: () => undefined,
            unregisterMediaAnalysisProvider: () => undefined,
            registerInferenceProvider: () => undefined,
            unregisterInferenceProvider: () => undefined,
            registerTool: () => undefined,
            unregisterTool: () => undefined,
            registerImageProvider: () => undefined,
            unregisterImageProvider: () => undefined,
            registerConnector: () => undefined,
            unregisterConnector: async () => undefined
        } as unknown as PluginRegistrar;

        const settings = elevenLabs.settingsSchema.parse({});
        const api: PluginApi<typeof settings> = {
            instance: { instanceId: "elevenlabs-main", pluginId: "elevenlabs", enabled: true },
            settings,
            engineSettings: {},
            logger: getLogger("test.elevenlabs.invalid-format"),
            auth,
            dataDir: dir,
            tmpDir: path.join(dir, "tmp"),
            usersDir: path.join(dir, "users"),
            registrar,
            exposes: {
                registerProvider: async () => undefined,
                unregisterProvider: async () => undefined,
                listProviders: () => []
            },
            fileStore: new FileFolder(path.join(config.dataDir, "files")),
            inference: {
                complete: async () => {
                    throw new Error("Inference not available in tests");
                }
            },
            processes: new Processes(dir, getLogger("test.processes.elevenlabs.invalid-format"), {
                repository: storage.processes
            }),
            mode: "runtime",
            events: {
                emit: () => undefined
            }
        };

        const instance = await elevenLabs.create(api);
        await instance.load?.();
        if (!registrationState.provider) {
            throw new Error("Speech provider was not registered");
        }

        await expect(
            registrationState.provider.generate(
                {
                    text: "Invalid format",
                    outputFormat: "flac"
                },
                {
                    auth,
                    fileStore: api.fileStore,
                    logger: getLogger("test.elevenlabs.invalid-format.generate")
                }
            )
        ).rejects.toThrow("Unsupported ElevenLabs output format");
        expect(convertMock).not.toHaveBeenCalled();
    });

    it("registers and executes direct music, sound effects, and voice isolator tools", async () => {
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-elevenlabs-tools-"));
        tempDirs.push(dir);

        const config = configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"));
        const auth = new AuthStore(config);
        await auth.setApiKey("elevenlabs", "test-elevenlabs-key");
        const storage = await storageOpenTest();

        const registrationState: {
            tools: Array<{ tool: { name: string }; execute: (...args: unknown[]) => Promise<unknown> }>;
            unregisteredTools: string[];
        } = {
            tools: [],
            unregisteredTools: []
        };

        const registrar = {
            registerSpeechProvider: () => undefined,
            unregisterSpeechProvider: () => undefined,
            registerMediaAnalysisProvider: () => undefined,
            unregisterMediaAnalysisProvider: () => undefined,
            registerInferenceProvider: () => undefined,
            unregisterInferenceProvider: () => undefined,
            registerTool: (definition: {
                tool: { name: string };
                execute: (...args: unknown[]) => Promise<unknown>;
            }) => {
                registrationState.tools.push(definition);
            },
            unregisterTool: (name: string) => {
                registrationState.unregisteredTools.push(name);
            },
            registerImageProvider: () => undefined,
            unregisterImageProvider: () => undefined,
            registerConnector: () => undefined,
            unregisterConnector: async () => undefined
        } as unknown as PluginRegistrar;

        composeMock.mockReturnValue({
            withRawResponse: async () => ({
                data: speechReadableFromText("music-bytes"),
                rawResponse: {
                    headers: new Headers({
                        "content-type": "audio/mpeg"
                    })
                }
            })
        });
        soundEffectsConvertMock.mockReturnValue({
            withRawResponse: async () => ({
                data: speechReadableFromText("sfx-bytes"),
                rawResponse: {
                    headers: new Headers({
                        "content-type": "audio/mpeg"
                    })
                }
            })
        });
        audioIsolationConvertMock.mockReturnValue({
            withRawResponse: async () => ({
                data: speechReadableFromText("isolation-bytes"),
                rawResponse: {
                    headers: new Headers({
                        "content-type": "audio/wav"
                    })
                }
            })
        });

        const settings = elevenLabs.settingsSchema.parse({});
        const api: PluginApi<typeof settings> = {
            instance: { instanceId: "elevenlabs-main", pluginId: "elevenlabs", enabled: true },
            settings,
            engineSettings: {},
            logger: getLogger("test.elevenlabs.tools"),
            auth,
            dataDir: dir,
            tmpDir: path.join(dir, "tmp"),
            usersDir: path.join(dir, "users"),
            registrar,
            exposes: {
                registerProvider: async () => undefined,
                unregisterProvider: async () => undefined,
                listProviders: () => []
            },
            fileStore: new FileFolder(path.join(config.dataDir, "files")),
            inference: {
                complete: async () => {
                    throw new Error("Inference not available in tests");
                }
            },
            processes: new Processes(dir, getLogger("test.processes.elevenlabs.tools"), {
                repository: storage.processes
            }),
            mode: "runtime",
            events: {
                emit: () => undefined
            }
        };

        const sandboxReadMock = vi.fn(async () => ({
            type: "binary" as const,
            content: Buffer.from("input-audio"),
            bytes: 11,
            resolvedPath: "/tmp/input.wav",
            displayPath: "/tmp/input.wav"
        }));
        const sandboxWriteMock = vi.fn(async (write: { path: string; content: string | Buffer }) => {
            const bytes = Buffer.isBuffer(write.content) ? write.content.length : Buffer.byteLength(write.content);
            return {
                bytes,
                resolvedPath: write.path,
                sandboxPath: write.path
            };
        });

        const toolContext = {
            auth,
            sandbox: {
                read: sandboxReadMock,
                write: sandboxWriteMock
            }
        };

        const instance = await elevenLabs.create(api);
        await instance.load?.();

        const toolByName = (name: string) => {
            const tool = registrationState.tools.find((candidate) => candidate.tool.name === name);
            if (!tool) {
                throw new Error(`Expected tool ${name} to be registered`);
            }
            return tool;
        };

        expect(registrationState.tools.map((tool) => tool.tool.name).sort()).toEqual([
            "elevenlabs_generate_music",
            "elevenlabs_generate_sound_effects",
            "elevenlabs_voice_isolator"
        ]);

        const musicTool = toolByName("elevenlabs_generate_music");
        const musicResult = (await musicTool.execute(
            {
                prompt: "lofi beat",
                duration_seconds: 8,
                output_format: "mpeg"
            },
            toolContext as never,
            { id: "music-1", name: "elevenlabs_generate_music" }
        )) as {
            typedResult: { filePath: string; fileName: string; mimeType: string };
        };
        expect(composeMock).toHaveBeenCalledWith(
            expect.objectContaining({
                prompt: "lofi beat",
                outputFormat: "mp3_44100_128",
                musicLengthMs: 8000,
                modelId: "music_v1"
            })
        );
        expect(musicResult.typedResult.fileName).toMatch(/^elevenlabs-music-\d+\.mp3$/);
        expect(musicResult.typedResult.filePath).toContain("~/downloads/");
        expect(musicResult.typedResult.mimeType).toBe("audio/mpeg");

        const soundEffectsTool = toolByName("elevenlabs_generate_sound_effects");
        await soundEffectsTool.execute(
            {
                prompt: "short whoosh",
                duration_seconds: 2.5,
                loop: false,
                prompt_influence: 0.75
            },
            toolContext as never,
            { id: "sfx-1", name: "elevenlabs_generate_sound_effects" }
        );
        expect(soundEffectsConvertMock).toHaveBeenCalledWith(
            expect.objectContaining({
                text: "short whoosh",
                durationSeconds: 2.5,
                loop: false,
                promptInfluence: 0.75,
                outputFormat: "mp3_44100_128"
            })
        );

        const voiceIsolatorTool = toolByName("elevenlabs_voice_isolator");
        await voiceIsolatorTool.execute(
            {
                path: "/tmp/input.wav",
                file_format: "other",
                input_mime_type: "audio/wav"
            },
            toolContext as never,
            { id: "iso-1", name: "elevenlabs_voice_isolator" }
        );
        expect(sandboxReadMock).toHaveBeenCalledWith({
            path: "/tmp/input.wav",
            binary: true
        });
        expect(audioIsolationConvertMock).toHaveBeenCalledWith(
            expect.objectContaining({
                fileFormat: "other",
                audio: expect.objectContaining({
                    filename: "input.wav",
                    contentType: "audio/wav"
                })
            })
        );
        expect(sandboxWriteMock).toHaveBeenCalledWith(
            expect.objectContaining({
                path: expect.stringMatching(/^~\/downloads\/elevenlabs-voice-isolated-\d+\.wav$/)
            })
        );

        await instance.unload?.();
        expect(registrationState.unregisteredTools.sort()).toEqual([
            "elevenlabs_generate_music",
            "elevenlabs_generate_sound_effects",
            "elevenlabs_voice_isolator"
        ]);
    });
});

function speechReadableFromText(value: string): ReadableStream<Uint8Array> {
    return new ReadableStream<Uint8Array>({
        start(controller) {
            controller.enqueue(Buffer.from(value));
            controller.close();
        }
    });
}
