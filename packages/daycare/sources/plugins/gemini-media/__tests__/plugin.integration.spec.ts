import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PluginApi } from "@/types";
import { AuthStore } from "../../../auth/store.js";
import { configResolve } from "../../../config/configResolve.js";
import { FileFolder } from "../../../engine/files/fileFolder.js";
import type { PluginRegistrar } from "../../../engine/plugins/registry.js";
import { Processes } from "../../../engine/processes/processes.js";
import { getLogger } from "../../../log.js";
import { storageOpenTest } from "../../../storage/storageOpenTest.js";
import { plugin as mediaAnalysis } from "../plugin.js";

type RegisteredProvider = {
    supportedTypes: string[];
    analyze: (request: unknown, context: unknown) => Promise<{ text: string }>;
};

describe("gemini-media plugin", () => {
    const tempDirs: string[] = [];

    afterEach(async () => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
        for (const dir of tempDirs.splice(0, tempDirs.length)) {
            await fs.rm(dir, { recursive: true, force: true });
        }
    });

    it("registers provider and analyzes image/audio with mocked Gemini", async () => {
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-gemini-media-"));
        tempDirs.push(dir);

        const config = configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"));
        const auth = new AuthStore(config);
        await auth.setApiKey("google", "test-google-key");
        const storage = await storageOpenTest();

        const registrationState: {
            provider: RegisteredProvider | null;
            unregisteredProviderId: string | null;
        } = {
            provider: null,
            unregisteredProviderId: null
        };

        const registrar = {
            registerMediaAnalysisProvider: (registered: RegisteredProvider) => {
                registrationState.provider = registered;
            },
            unregisterMediaAnalysisProvider: (id: string) => {
                registrationState.unregisteredProviderId = id;
            },
            registerInferenceProvider: () => undefined,
            unregisterInferenceProvider: () => undefined,
            registerTool: () => undefined,
            unregisterTool: () => undefined,
            registerImageProvider: () => undefined,
            unregisterImageProvider: () => undefined,
            registerConnector: () => undefined,
            unregisterConnector: async () => undefined
        } as unknown as PluginRegistrar;

        const fetchMock = vi.fn(async () => {
            return new Response(
                JSON.stringify({
                    candidates: [
                        {
                            content: {
                                parts: [{ text: "alpha " }, { text: "beta" }]
                            }
                        }
                    ]
                }),
                {
                    status: 200,
                    headers: {
                        "Content-Type": "application/json"
                    }
                }
            );
        });
        vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

        const settings = mediaAnalysis.settingsSchema.parse({
            supportedTypes: ["image", "audio"]
        });
        const api: PluginApi<typeof settings> = {
            instance: { instanceId: "gemini-media-main", pluginId: "gemini-media", enabled: true },
            settings,
            engineSettings: {},
            logger: getLogger("test.gemini-media"),
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
            processes: new Processes(dir, getLogger("test.processes.gemini-media"), {
                repository: storage.processes
            }),
            mode: "runtime",
            webhooks: {
                trigger: async () => {
                    throw new Error("Webhook runtime unavailable.");
                }
            },
            events: {
                emit: () => undefined
            }
        };

        const instance = await mediaAnalysis.create(api);
        await instance.load?.();

        if (!registrationState.provider) {
            throw new Error("Provider was not registered");
        }
        expect(registrationState.provider.supportedTypes).toEqual(["image", "audio"]);

        const imagePath = path.join(dir, "sample.png");
        const audioPath = path.join(dir, "sample.mp3");
        await fs.writeFile(imagePath, Buffer.from([1, 2, 3]));
        await fs.writeFile(audioPath, Buffer.from([4, 5, 6]));

        const imageResult = await registrationState.provider.analyze(
            {
                filePath: imagePath,
                mimeType: "image/png",
                mediaType: "image",
                prompt: "Describe image"
            },
            {
                auth,
                logger: getLogger("test.gemini-media.image")
            }
        );
        const audioResult = await registrationState.provider.analyze(
            {
                filePath: audioPath,
                mimeType: "audio/mpeg",
                mediaType: "audio",
                prompt: "Describe audio"
            },
            {
                auth,
                logger: getLogger("test.gemini-media.audio")
            }
        );

        expect(imageResult.text).toBe("alpha beta");
        expect(audioResult.text).toBe("alpha beta");
        expect(fetchMock).toHaveBeenCalledTimes(2);

        const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit]>;
        const imageInit = calls[0]?.[1];
        const audioInit = calls[1]?.[1];
        if (!imageInit?.body || !audioInit?.body) {
            throw new Error("Missing mocked request payloads");
        }
        const imageBody = JSON.parse(String(imageInit.body)) as {
            contents: Array<{
                parts: Array<
                    | { text: string }
                    | {
                          inlineData: {
                              mimeType: string;
                              data: string;
                          };
                      }
                >;
            }>;
        };
        const audioBody = JSON.parse(String(audioInit.body)) as {
            contents: Array<{
                parts: Array<
                    | { text: string }
                    | {
                          inlineData: {
                              mimeType: string;
                              data: string;
                          };
                      }
                >;
            }>;
        };

        expect(fetchMock).toHaveBeenNthCalledWith(
            1,
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent",
            expect.objectContaining({
                method: "POST",
                headers: expect.objectContaining({ "x-goog-api-key": "test-google-key" })
            })
        );
        expect(imageBody.contents[0]?.parts[0]).toEqual({ text: "Describe image" });
        expect(imageBody.contents[0]?.parts[1]).toEqual({
            inlineData: {
                mimeType: "image/png",
                data: Buffer.from([1, 2, 3]).toString("base64")
            }
        });

        expect(audioBody.contents[0]?.parts[0]).toEqual({ text: "Describe audio" });
        expect(audioBody.contents[0]?.parts[1]).toEqual({
            inlineData: {
                mimeType: "audio/mpeg",
                data: Buffer.from([4, 5, 6]).toString("base64")
            }
        });

        await instance.unload?.();
        expect(registrationState.unregisteredProviderId).toBe("gemini-media");
    });

    it("rejects files larger than maxFileSizeBytes before fetch", async () => {
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-gemini-media-"));
        tempDirs.push(dir);

        const config = configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"));
        const auth = new AuthStore(config);
        await auth.setApiKey("google", "test-google-key");
        const storage = await storageOpenTest();

        const registrationState: {
            provider: RegisteredProvider | null;
        } = {
            provider: null
        };
        const registrar = {
            registerMediaAnalysisProvider: (registered: RegisteredProvider) => {
                registrationState.provider = registered;
            },
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

        const fetchMock = vi.fn(async () => {
            return new Response("{}", { status: 200 });
        });
        vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

        const settings = mediaAnalysis.settingsSchema.parse({
            maxFileSizeBytes: 2
        });
        const api: PluginApi<typeof settings> = {
            instance: { instanceId: "gemini-media-main", pluginId: "gemini-media", enabled: true },
            settings,
            engineSettings: {},
            logger: getLogger("test.gemini-media"),
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
            processes: new Processes(dir, getLogger("test.processes.gemini-media"), {
                repository: storage.processes
            }),
            mode: "runtime",
            webhooks: {
                trigger: async () => {
                    throw new Error("Webhook runtime unavailable.");
                }
            },
            events: {
                emit: () => undefined
            }
        };

        const instance = await mediaAnalysis.create(api);
        await instance.load?.();

        if (!registrationState.provider) {
            throw new Error("Provider was not registered");
        }

        const imagePath = path.join(dir, "sample.png");
        await fs.writeFile(imagePath, Buffer.from([1, 2, 3]));

        await expect(
            registrationState.provider.analyze(
                {
                    filePath: imagePath,
                    mimeType: "image/png",
                    mediaType: "image",
                    prompt: "Describe image"
                },
                {
                    auth,
                    logger: getLogger("test.gemini-media.image")
                }
            )
        ).rejects.toThrow("Media file too large");
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
