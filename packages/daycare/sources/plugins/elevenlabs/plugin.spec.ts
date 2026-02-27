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

const { convertMock, elevenLabsClientMock } = vi.hoisted(() => {
    const convert = vi.fn();
    const client = vi.fn(() => ({
        textToSpeech: {
            convert
        }
    }));
    return {
        convertMock: convert,
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
        elevenLabsClientMock.mockReset();
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
});

function speechReadableFromText(value: string): ReadableStream<Uint8Array> {
    return new ReadableStream<Uint8Array>({
        start(controller) {
            controller.enqueue(Buffer.from(value));
            controller.close();
        }
    });
}
