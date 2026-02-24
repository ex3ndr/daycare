import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PluginSystemPromptResult } from "@/types";
import { contextForUser } from "../../engine/agents/context.js";

type MockFn = ReturnType<typeof vi.fn>;
type TelegramBotMock = {
    getChat: MockFn;
    getUserProfilePhotos: MockFn;
    downloadFile: MockFn;
};

type TelegramConnectorMock = {
    options: unknown;
    commandSyncStart: MockFn;
    bot: TelegramBotMock;
};

const connectorInstances: TelegramConnectorMock[] = [];

vi.mock("./connector.js", () => {
    class TelegramConnector {
        options: unknown;
        commandSyncStart = vi.fn();
        bot: TelegramBotMock;

        constructor(options: unknown) {
            this.options = options;
            this.bot = {
                getChat: vi.fn(),
                getUserProfilePhotos: vi.fn(),
                downloadFile: vi.fn()
            };
            connectorInstances.push(this as unknown as TelegramConnectorMock);
        }

        botGet(): TelegramBotMock {
            return this.bot;
        }
    }

    return { TelegramConnector };
});

import { plugin } from "./plugin.js";

const tempRoots: string[] = [];

async function tempDirCreate(): Promise<string> {
    const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-telegram-plugin-"));
    tempRoots.push(dir);
    return dir;
}

function pluginApiBuild(dataDir: string) {
    const registerConnector = vi.fn();
    const unregisterConnector = vi.fn(async () => undefined);
    return {
        api: {
            instance: {
                instanceId: "telegram",
                pluginId: "telegram",
                enabled: true,
                settings: {}
            },
            settings: {
                mode: "private",
                allowedUids: ["123"],
                polling: false,
                clearWebhook: false,
                statePath: null
            },
            engineSettings: {} as never,
            logger: {
                debug: vi.fn(),
                info: vi.fn(),
                warn: vi.fn(),
                error: vi.fn()
            } as never,
            auth: {
                getToken: vi.fn(async () => "telegram-token"),
                setToken: vi.fn(async () => undefined)
            } as never,
            dataDir,
            tmpDir: path.join(dataDir, "tmp"),
            registrar: {
                registerConnector,
                unregisterConnector
            } as never,
            exposes: {
                registerProvider: async () => undefined,
                unregisterProvider: async () => undefined,
                listProviders: () => []
            },
            fileStore: {} as never,
            inference: {} as never,
            processes: {} as never,
            mode: "runtime" as const,
            events: {
                emit: vi.fn()
            }
        },
        registerConnector,
        unregisterConnector
    };
}

function systemPromptRequire(instance: Awaited<ReturnType<typeof plugin.create>>) {
    if (typeof instance.systemPrompt !== "function") {
        throw new Error("Expected telegram plugin systemPrompt to be a function.");
    }
    return instance.systemPrompt;
}

function systemPromptResultRequire(result: string | PluginSystemPromptResult | null): PluginSystemPromptResult {
    if (!result || typeof result === "string") {
        throw new Error("Expected plugin systemPrompt to return PluginSystemPromptResult.");
    }
    return result;
}

describe("telegram plugin settings schema", () => {
    it("allows public mode without allowedUids", () => {
        const parsed = plugin.settingsSchema.parse({
            mode: "public"
        }) as { mode: "public" | "private"; allowedUids: string[] };

        expect(parsed.mode).toBe("public");
        expect(parsed.allowedUids).toEqual([]);
    });

    it("requires at least one allowed UID in private mode", () => {
        const parsed = plugin.settingsSchema.safeParse({
            mode: "private"
        });

        expect(parsed.success).toBe(false);
        if (parsed.success) {
            return;
        }
        expect(parsed.error.issues[0]?.path).toEqual(["allowedUids"]);
        expect(parsed.error.issues[0]?.message).toBe("allowedUids must have at least 1 entry in private mode");
    });
});

describe("telegram plugin onboarding", () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it("skips UID prompt in public mode", async () => {
        const input = vi.fn(async () => "token");
        const selectMock = vi.fn(async () => "public");
        const select: Parameters<NonNullable<typeof plugin.onboarding>>[0]["prompt"]["select"] = async <
            TValue extends string
        >() => (await selectMock()) as unknown as TValue | null;
        const setToken = vi.fn(async () => undefined);

        const result = await plugin.onboarding?.({
            instanceId: "telegram",
            pluginId: "telegram",
            dataDir: "/tmp/daycare",
            auth: { setToken } as never,
            prompt: {
                input,
                select,
                confirm: async () => null
            },
            note: vi.fn()
        });

        expect(result).toEqual({
            settings: { mode: "public" }
        });
        expect(input).toHaveBeenCalledTimes(1);
        expect(selectMock).toHaveBeenCalledTimes(1);
        expect(setToken).toHaveBeenCalledWith("telegram", "token");
    });

    it("prompts for UIDs in private mode", async () => {
        const input = vi.fn().mockResolvedValueOnce("token").mockResolvedValueOnce("123, 456,123");
        const selectMock = vi.fn(async () => "private");
        const select: Parameters<NonNullable<typeof plugin.onboarding>>[0]["prompt"]["select"] = async <
            TValue extends string
        >() => (await selectMock()) as unknown as TValue | null;
        const setToken = vi.fn(async () => undefined);

        const result = await plugin.onboarding?.({
            instanceId: "telegram",
            pluginId: "telegram",
            dataDir: "/tmp/daycare",
            auth: { setToken } as never,
            prompt: {
                input,
                select,
                confirm: async () => null
            },
            note: vi.fn()
        });

        expect(result).toEqual({
            settings: { mode: "private", allowedUids: ["123", "456"] }
        });
        expect(input).toHaveBeenCalledTimes(2);
        expect(selectMock).toHaveBeenCalledTimes(1);
        expect(setToken).toHaveBeenCalledWith("telegram", "token");
    });

    it("does not persist token when private UID prompt is canceled", async () => {
        const input = vi.fn().mockResolvedValueOnce("token").mockResolvedValueOnce(null);
        const selectMock = vi.fn(async () => "private");
        const select: Parameters<NonNullable<typeof plugin.onboarding>>[0]["prompt"]["select"] = async <
            TValue extends string
        >() => (await selectMock()) as unknown as TValue | null;
        const setToken = vi.fn(async () => undefined);

        const result = await plugin.onboarding?.({
            instanceId: "telegram",
            pluginId: "telegram",
            dataDir: "/tmp/daycare",
            auth: { setToken } as never,
            prompt: {
                input,
                select,
                confirm: async () => null
            },
            note: vi.fn()
        });

        expect(result).toBeNull();
        expect(setToken).not.toHaveBeenCalled();
    });
});

describe("telegram plugin system prompt", () => {
    afterEach(async () => {
        connectorInstances.length = 0;
        for (const dir of tempRoots.splice(0, tempRoots.length)) {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("returns null for non-telegram descriptors", async () => {
        const dataDir = await tempDirCreate();
        const built = pluginApiBuild(dataDir);
        const instance = await plugin.create(built.api as never);
        await instance.load?.();
        const systemPrompt = systemPromptRequire(instance);

        const result = await systemPrompt({
            ctx: contextForUser({ userId: "user-1" }),
            descriptor: {
                type: "user",
                connector: "whatsapp",
                userId: "123",
                channelId: "123"
            },
            userDownloadsDir: path.join(dataDir, "downloads")
        });

        expect(result).toBeNull();
    });

    it("blocks on first fetch and copies avatar to user downloads", async () => {
        const dataDir = await tempDirCreate();
        const built = pluginApiBuild(dataDir);
        const instance = await plugin.create(built.api as never);
        await instance.load?.();
        const systemPrompt = systemPromptRequire(instance);
        const connector = connectorInstances[0];
        expect(connector).toBeDefined();
        connector!.bot.getChat.mockResolvedValue({
            id: 123,
            type: "private",
            first_name: "Ada",
            last_name: "Lovelace",
            username: "ada"
        });
        connector!.bot.getUserProfilePhotos.mockResolvedValue({
            total_count: 1,
            photos: [[{ file_id: "avatar-1" }]]
        });
        connector!.bot.downloadFile.mockImplementation(async (_fileId: string, downloadDir: string) => {
            const downloaded = path.join(downloadDir, "downloaded-avatar.jpg");
            await mkdir(downloadDir, { recursive: true });
            await writeFile(downloaded, "avatar-v1", "utf8");
            return downloaded;
        });
        const userDownloadsDir = path.join(dataDir, "user-downloads");
        const expectedAvatarPath = path.join(userDownloadsDir, "profile-telegram-123-avatar-avatar-1.jpg");

        const first = await systemPrompt({
            ctx: contextForUser({ userId: "user-1" }),
            descriptor: {
                type: "user",
                connector: "telegram",
                userId: "123",
                channelId: "123"
            },
            userDownloadsDir
        });

        const firstResult = systemPromptResultRequire(first);
        expect(firstResult.text).toContain("Name: Ada Lovelace");
        expect(firstResult.images).toEqual([expectedAvatarPath]);
        expect(await readFile(firstResult.images![0]!, "utf8")).toBe("avatar-v1");
        expect(connector!.bot.getChat).toHaveBeenCalledTimes(1);

        await rm(firstResult.images![0]!, { force: true });
        const second = await systemPrompt({
            ctx: contextForUser({ userId: "user-1" }),
            descriptor: {
                type: "user",
                connector: "telegram",
                userId: "123",
                channelId: "123"
            },
            userDownloadsDir
        });

        const secondResult = systemPromptResultRequire(second);
        expect(secondResult.images).toEqual([expectedAvatarPath]);
        expect(await readFile(secondResult.images![0]!, "utf8")).toBe("avatar-v1");
        expect(connector!.bot.getChat).toHaveBeenCalledTimes(1);
    });

    it("returns stale cache immediately and refreshes in background", async () => {
        const dataDir = await tempDirCreate();
        const profileDir = path.join(dataDir, "profiles", "123");
        await mkdir(profileDir, { recursive: true });
        await writeFile(
            path.join(profileDir, "profile.json"),
            JSON.stringify(
                {
                    telegramUserId: "123",
                    firstName: "Old Name",
                    fetchedAt: Date.now() - 3_600_001
                },
                null,
                2
            ),
            "utf8"
        );

        const built = pluginApiBuild(dataDir);
        const instance = await plugin.create(built.api as never);
        await instance.load?.();
        const systemPrompt = systemPromptRequire(instance);
        const connector = connectorInstances[0];
        expect(connector).toBeDefined();
        connector!.bot.getChat.mockResolvedValue({
            id: 123,
            type: "private",
            first_name: "Fresh Name"
        });
        connector!.bot.getUserProfilePhotos.mockResolvedValue({
            total_count: 0,
            photos: []
        });

        const stale = await systemPrompt({
            ctx: contextForUser({ userId: "user-1" }),
            descriptor: {
                type: "user",
                connector: "telegram",
                userId: "123",
                channelId: "123"
            },
            userDownloadsDir: path.join(dataDir, "user-downloads")
        });

        expect(systemPromptResultRequire(stale).text).toContain("Name: Old Name");

        await vi.waitFor(() => {
            expect(connector!.bot.getChat).toHaveBeenCalledTimes(1);
        });

        await vi.waitFor(async () => {
            const fresh = await systemPrompt({
                ctx: contextForUser({ userId: "user-1" }),
                descriptor: {
                    type: "user",
                    connector: "telegram",
                    userId: "123",
                    channelId: "123"
                },
                userDownloadsDir: path.join(dataDir, "user-downloads")
            });
            expect(systemPromptResultRequire(fresh).text).toContain("Name: Fresh Name");
        });
    });

    it("removes stale cached and user-downloaded avatars when Telegram avatars are removed", async () => {
        const dataDir = await tempDirCreate();
        const profileDir = path.join(dataDir, "profiles", "123");
        const oldCacheA = path.join(profileDir, "avatar-old-a.jpg");
        const oldCacheB = path.join(profileDir, "avatar-old-b.jpg");
        await mkdir(profileDir, { recursive: true });
        await writeFile(oldCacheA, "old-a", "utf8");
        await writeFile(oldCacheB, "old-b", "utf8");
        await writeFile(
            path.join(profileDir, "profile.json"),
            JSON.stringify(
                {
                    telegramUserId: "123",
                    firstName: "Old Name",
                    avatarFileIds: ["old-a", "old-b"],
                    avatarPaths: [oldCacheA, oldCacheB],
                    fetchedAt: Date.now() - 3_600_001
                },
                null,
                2
            ),
            "utf8"
        );
        const userDownloadsDir = path.join(dataDir, "user-downloads");
        await mkdir(userDownloadsDir, { recursive: true });
        const oldDownloadA = path.join(userDownloadsDir, "profile-telegram-123-avatar-old-a.jpg");
        const oldDownloadB = path.join(userDownloadsDir, "profile-telegram-123-avatar-old-b.jpg");
        await writeFile(oldDownloadA, "old-a", "utf8");
        await writeFile(oldDownloadB, "old-b", "utf8");

        const built = pluginApiBuild(dataDir);
        const instance = await plugin.create(built.api as never);
        await instance.load?.();
        const systemPrompt = systemPromptRequire(instance);
        const connector = connectorInstances[0];
        expect(connector).toBeDefined();
        connector!.bot.getChat.mockResolvedValue({
            id: 123,
            type: "private",
            first_name: "Fresh Name"
        });
        connector!.bot.getUserProfilePhotos.mockResolvedValue({
            total_count: 0,
            photos: []
        });

        const stale = await systemPrompt({
            ctx: contextForUser({ userId: "user-1" }),
            descriptor: {
                type: "user",
                connector: "telegram",
                userId: "123",
                channelId: "123"
            },
            userDownloadsDir
        });
        expect(systemPromptResultRequire(stale).images).toEqual([oldDownloadA, oldDownloadB]);

        await vi.waitFor(async () => {
            const files = await readdir(userDownloadsDir);
            expect(files).toEqual([]);
        });
        await vi.waitFor(async () => {
            await expect(stat(oldCacheA)).rejects.toBeTruthy();
            await expect(stat(oldCacheB)).rejects.toBeTruthy();
        });

        const fresh = await systemPrompt({
            ctx: contextForUser({ userId: "user-1" }),
            descriptor: {
                type: "user",
                connector: "telegram",
                userId: "123",
                channelId: "123"
            },
            userDownloadsDir
        });
        expect(systemPromptResultRequire(fresh).images).toBeUndefined();
    });
});
