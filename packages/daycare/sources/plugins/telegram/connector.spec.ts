import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MessageContext } from "@/types";
import type { FileFolder } from "../../engine/files/fileFolder.js";

type Handler = (payload: unknown) => void | Promise<void>;
type MockFn = ReturnType<typeof vi.fn>;
type TelegramBotMock = {
    handlers: Map<string, Handler[]>;
    sendMessage: MockFn;
    setMyCommands: MockFn;
    setChatMenuButton: MockFn;
    sendPhoto: MockFn;
    sendVideo: MockFn;
    sendDocument: MockFn;
    sendVoice: MockFn;
    downloadFile: MockFn;
    editMessageText: MockFn;
    answerCallbackQuery: MockFn;
    startPolling: MockFn;
    deleteWebHook: MockFn;
};

const telegramInstances: TelegramBotMock[] = [];

vi.mock("node-telegram-bot-api", () => {
    class TelegramBotMockClass {
        handlers = new Map<string, Handler[]>();
        sendMessage = vi.fn(async () => ({ message_id: 101, chat: { id: 123 } }));
        setMyCommands = vi.fn(async () => true);
        setChatMenuButton = vi.fn(async () => true);
        sendPhoto = vi.fn(async () => ({ message_id: 101, chat: { id: 123 } }));
        sendVideo = vi.fn(async () => ({ message_id: 101, chat: { id: 123 } }));
        sendDocument = vi.fn(async () => ({ message_id: 101, chat: { id: 123 } }));
        sendVoice = vi.fn(async () => ({ message_id: 101, chat: { id: 123 } }));
        downloadFile = vi.fn(async () => "/tmp/downloaded-file");
        editMessageText = vi.fn(async () => undefined);
        answerCallbackQuery = vi.fn(async () => undefined);
        isPolling = vi.fn(() => false);
        startPolling = vi.fn(async () => undefined);
        stopPolling = vi.fn(async () => undefined);
        deleteWebHook = vi.fn(async () => undefined);

        constructor() {
            telegramInstances.push(this as unknown as TelegramBotMock);
        }

        on(event: string, handler: Handler): void {
            const handlers = this.handlers.get(event) ?? [];
            handlers.push(handler);
            this.handlers.set(event, handlers);
        }

        processUpdate(_update: unknown): void {}
    }

    return { default: TelegramBotMockClass };
});

import { TelegramConnector } from "./connector.js";

describe("TelegramConnector commands", () => {
    beforeEach(() => {
        telegramInstances.length = 0;
    });

    it("routes /reset to command handlers", async () => {
        const fileStore = { saveFromPath: vi.fn() } as unknown as FileFolder;
        const connector = new TelegramConnector({
            token: "token",
            allowedUids: ["123"],
            polling: false,
            clearWebhook: false,
            statePath: null,
            fileStore,
            dataDir: "/tmp",
            enableGracefulShutdown: false
        });

        const messageHandlerMock = vi.fn(async (_message, _context, _descriptor) => undefined);
        const commandHandler = vi.fn(async (_command, _context, _descriptor) => undefined);
        connector.onMessage(messageHandlerMock);
        connector.onCommand(commandHandler);

        const bot = telegramInstances[0];
        expect(bot).toBeTruthy();
        const botMessageHandler = bot!.handlers.get("message")?.[0];
        await botMessageHandler?.({
            message_id: 55,
            chat: { id: 123, type: "private" },
            from: { id: 123 },
            text: "/reset"
        });

        expect(messageHandlerMock).not.toHaveBeenCalled();
        expect(commandHandler).toHaveBeenCalledTimes(1);
        const [command, context, target] = commandHandler.mock.calls[0] as [string, MessageContext, string];
        expect(command).toBe("/reset");
        expect(context).toMatchObject({ messageId: "55" });
        expect(target).toBe("/123/telegram/123/123");
    });

    it("routes group commands with channel/user target suffix", async () => {
        const fileStore = { saveFromPath: vi.fn() } as unknown as FileFolder;
        const connector = new TelegramConnector({
            token: "token",
            allowedUids: ["456"],
            polling: false,
            clearWebhook: false,
            statePath: null,
            fileStore,
            dataDir: "/tmp",
            enableGracefulShutdown: false
        });

        const commandHandler = vi.fn(async (_command, _context, _target) => undefined);
        connector.onCommand(commandHandler);

        const bot = telegramInstances[0];
        expect(bot).toBeTruthy();
        const botMessageHandler = bot!.handlers.get("message")?.[0];
        await botMessageHandler?.({
            message_id: 57,
            chat: { id: -100321, type: "group" },
            from: { id: 456 },
            text: "/reset"
        });

        expect(commandHandler).toHaveBeenCalledTimes(1);
        const target = commandHandler.mock.calls[0]?.[2] as string;
        expect(target).toBe("/-100321/telegram/-100321/456");
    });
});

describe("TelegramConnector incoming documents", () => {
    beforeEach(() => {
        telegramInstances.length = 0;
    });

    it("routes incoming documents to message handlers", async () => {
        const fileStore = {
            saveFromPath: vi.fn(async (input: { name: string; mimeType: string; path: string }) => ({
                id: "f-1",
                name: input.name,
                mimeType: input.mimeType,
                path: "/tmp/stored-report.pdf",
                size: 128
            }))
        } as unknown as FileFolder;
        const connector = new TelegramConnector({
            token: "token",
            allowedUids: ["123"],
            polling: false,
            clearWebhook: false,
            statePath: null,
            fileStore,
            dataDir: "/tmp",
            enableGracefulShutdown: false
        });
        const messageHandlerMock = vi.fn(async (_message, _context, _descriptor) => undefined);
        connector.onMessage(messageHandlerMock);

        const bot = telegramInstances[0];
        expect(bot).toBeTruthy();
        bot!.downloadFile.mockResolvedValueOnce("/tmp/downloaded-report.pdf");
        const botMessageHandler = bot!.handlers.get("message")?.[0];
        await botMessageHandler?.({
            message_id: 55,
            chat: { id: 123, type: "private" },
            from: { id: 123 },
            document: {
                file_id: "doc-1",
                file_name: "report.pdf",
                mime_type: "application/pdf"
            }
        });

        expect(messageHandlerMock).toHaveBeenCalledTimes(1);
        const [message, context, target] = messageHandlerMock.mock.calls[0] as [
            { text: string | null; files?: Array<{ name: string; mimeType: string; path: string; size: number }> },
            MessageContext,
            string
        ];
        expect(message.text).toBe("Document received: report.pdf.");
        expect(message.files).toEqual([
            {
                id: "f-1",
                name: "report.pdf",
                mimeType: "application/pdf",
                path: "/tmp/stored-report.pdf",
                size: 128
            }
        ]);
        expect(context).toMatchObject({ messageId: "55" });
        expect(target).toBe("/123/telegram/123/123");
    });

    it("adds fallback text when document download fails", async () => {
        const fileStore = {
            saveFromPath: vi.fn()
        } as unknown as FileFolder;
        const connector = new TelegramConnector({
            token: "token",
            allowedUids: ["123"],
            polling: false,
            clearWebhook: false,
            statePath: null,
            fileStore,
            dataDir: "/tmp",
            enableGracefulShutdown: false
        });
        const messageHandlerMock = vi.fn(async (_message, _context, _descriptor) => undefined);
        connector.onMessage(messageHandlerMock);

        const bot = telegramInstances[0];
        expect(bot).toBeTruthy();
        bot!.downloadFile.mockRejectedValueOnce(new Error("download failed"));
        const botMessageHandler = bot!.handlers.get("message")?.[0];
        await botMessageHandler?.({
            message_id: 56,
            chat: { id: 123, type: "private" },
            from: { id: 123 },
            document: {
                file_id: "doc-2",
                file_name: "notes.txt",
                mime_type: "text/plain"
            }
        });

        expect(messageHandlerMock).toHaveBeenCalledTimes(1);
        const [message] = messageHandlerMock.mock.calls[0] as [
            { text: string | null; files?: unknown[] },
            MessageContext,
            string
        ];
        expect(message.text).toBe("Document received: notes.txt (download failed).");
        expect(message.files).toBeUndefined();
    });
});

describe("TelegramConnector incoming voice", () => {
    beforeEach(() => {
        telegramInstances.length = 0;
    });

    it("routes incoming voice messages to message handlers", async () => {
        const fileStore = {
            saveFromPath: vi.fn(async (input: { name: string; mimeType: string; path: string }) => ({
                id: "f-voice",
                name: input.name,
                mimeType: input.mimeType,
                path: "/tmp/stored-voice.ogg",
                size: 256
            }))
        } as unknown as FileFolder;
        const connector = new TelegramConnector({
            token: "token",
            allowedUids: ["123"],
            polling: false,
            clearWebhook: false,
            statePath: null,
            fileStore,
            dataDir: "/tmp",
            enableGracefulShutdown: false
        });
        const messageHandlerMock = vi.fn(async (_message, _context, _descriptor) => undefined);
        connector.onMessage(messageHandlerMock);

        const bot = telegramInstances[0];
        expect(bot).toBeTruthy();
        bot!.downloadFile.mockResolvedValueOnce("/tmp/downloaded-voice.ogg");
        const botMessageHandler = bot!.handlers.get("message")?.[0];
        await botMessageHandler?.({
            message_id: 57,
            chat: { id: 123, type: "private" },
            from: { id: 123 },
            voice: {
                file_id: "voice-1",
                mime_type: "audio/ogg"
            }
        });

        expect(messageHandlerMock).toHaveBeenCalledTimes(1);
        const [message, context, target] = messageHandlerMock.mock.calls[0] as [
            { text: string | null; files?: Array<{ name: string; mimeType: string; path: string; size: number }> },
            MessageContext,
            string
        ];
        expect(message.text).toBeNull();
        expect(message.files).toEqual([
            {
                id: "f-voice",
                name: "voice-voice-1.ogg",
                mimeType: "audio/ogg",
                path: "/tmp/stored-voice.ogg",
                size: 256
            }
        ]);
        expect(context).toMatchObject({ messageId: "57" });
        expect(target).toBe("/123/telegram/123/123");
    });
});

describe("TelegramConnector incoming stickers", () => {
    beforeEach(() => {
        telegramInstances.length = 0;
    });

    it.each([
        {
            caseName: "static stickers as webp image files",
            sticker: { file_id: "sticker-static", is_animated: false, is_video: false },
            expectedName: "sticker-sticker-static.webp",
            expectedMimeType: "image/webp",
            storedPath: "/tmp/stored-sticker.webp"
        },
        {
            caseName: "animated stickers as tgs files",
            sticker: { file_id: "sticker-animated", is_animated: true, is_video: false },
            expectedName: "sticker-sticker-animated.tgs",
            expectedMimeType: "application/x-tgsticker",
            storedPath: "/tmp/stored-sticker.tgs"
        },
        {
            caseName: "video stickers as webm files",
            sticker: { file_id: "sticker-video", is_animated: false, is_video: true },
            expectedName: "sticker-sticker-video.webm",
            expectedMimeType: "video/webm",
            storedPath: "/tmp/stored-sticker.webm"
        }
    ])("routes incoming $caseName to message handlers", async (entry) => {
        const fileStore = {
            saveFromPath: vi.fn(async (input: { name: string; mimeType: string; path: string }) => ({
                id: "f-sticker",
                name: input.name,
                mimeType: input.mimeType,
                path: entry.storedPath,
                size: 512
            }))
        } as unknown as FileFolder;
        const connector = new TelegramConnector({
            token: "token",
            allowedUids: ["123"],
            polling: false,
            clearWebhook: false,
            statePath: null,
            fileStore,
            dataDir: "/tmp",
            enableGracefulShutdown: false
        });
        const messageHandlerMock = vi.fn(async (_message, _context, _descriptor) => undefined);
        connector.onMessage(messageHandlerMock);

        const bot = telegramInstances[0];
        expect(bot).toBeTruthy();
        bot!.downloadFile.mockResolvedValueOnce(`/tmp/downloaded-${entry.sticker.file_id}`);
        const botMessageHandler = bot!.handlers.get("message")?.[0];
        await botMessageHandler?.({
            message_id: 58,
            chat: { id: 123, type: "private" },
            from: { id: 123 },
            sticker: entry.sticker
        });

        expect(messageHandlerMock).toHaveBeenCalledTimes(1);
        const [message] = messageHandlerMock.mock.calls[0] as [
            { text: string | null; files?: Array<{ name: string; mimeType: string; path: string; size: number }> },
            MessageContext,
            string
        ];
        expect(message.text).toBeNull();
        expect(message.files).toEqual([
            {
                id: "f-sticker",
                name: entry.expectedName,
                mimeType: entry.expectedMimeType,
                path: entry.storedPath,
                size: 512
            }
        ]);
        expect(fileStore.saveFromPath).toHaveBeenCalledWith(
            expect.objectContaining({
                name: entry.expectedName,
                mimeType: entry.expectedMimeType
            })
        );
    });

    it("does not redownload stickers when Telegram file_id is already cached", async () => {
        const fileStore = {
            saveFromPath: vi.fn(async (input: { name: string; mimeType: string; path: string }) => ({
                id: "f-sticker-cached",
                name: input.name,
                mimeType: input.mimeType,
                path: "/tmp/stored-sticker-cached.webp",
                size: 777
            }))
        } as unknown as FileFolder;
        const connector = new TelegramConnector({
            token: "token",
            allowedUids: ["123"],
            polling: false,
            clearWebhook: false,
            statePath: null,
            fileStore,
            dataDir: "/tmp",
            enableGracefulShutdown: false
        });
        const messageHandlerMock = vi.fn(async (_message, _context, _descriptor) => undefined);
        connector.onMessage(messageHandlerMock);

        const bot = telegramInstances[0];
        expect(bot).toBeTruthy();
        bot!.downloadFile.mockResolvedValue("/tmp/downloaded-sticker-cached");
        const botMessageHandler = bot!.handlers.get("message")?.[0];
        const sticker = { file_id: "sticker-cached", is_animated: false, is_video: false };

        await botMessageHandler?.({
            message_id: 59,
            chat: { id: 123, type: "private" },
            from: { id: 123 },
            sticker
        });
        await botMessageHandler?.({
            message_id: 60,
            chat: { id: 123, type: "private" },
            from: { id: 123 },
            sticker
        });

        expect(messageHandlerMock).toHaveBeenCalledTimes(2);
        const firstMessage = messageHandlerMock.mock.calls[0]?.[0] as {
            files?: Array<{ id: string; name: string; mimeType: string; path: string; size: number }>;
        };
        const secondMessage = messageHandlerMock.mock.calls[1]?.[0] as {
            files?: Array<{ id: string; name: string; mimeType: string; path: string; size: number }>;
        };
        expect(firstMessage.files).toEqual([
            {
                id: "f-sticker-cached",
                name: "sticker-sticker-cached.webp",
                mimeType: "image/webp",
                path: "/tmp/stored-sticker-cached.webp",
                size: 777
            }
        ]);
        expect(secondMessage.files).toEqual(firstMessage.files);
        expect(bot!.downloadFile).toHaveBeenCalledTimes(1);
        expect(fileStore.saveFromPath).toHaveBeenCalledTimes(1);
    });

    it("reloads cached file_id entries from state and skips redownload after restart", async () => {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-telegram-sticker-cache-"));
        const statePath = path.join(tempDir, "telegram-offset.json");

        const firstFileStore = {
            saveFromPath: vi.fn(async (input: { name: string; mimeType: string; path: string }) => ({
                id: "f-sticker-persisted",
                name: input.name,
                mimeType: input.mimeType,
                path: "/tmp/stored-sticker-persisted.webp",
                size: 901
            }))
        } as unknown as FileFolder;
        const firstConnector = new TelegramConnector({
            token: "token",
            allowedUids: ["123"],
            polling: false,
            clearWebhook: false,
            statePath,
            fileStore: firstFileStore,
            dataDir: tempDir,
            enableGracefulShutdown: false
        });
        const firstMessageHandler = vi.fn(async (_message, _context, _descriptor) => undefined);
        firstConnector.onMessage(firstMessageHandler);

        const firstBot = telegramInstances[0];
        expect(firstBot).toBeTruthy();
        firstBot!.downloadFile.mockResolvedValue("/tmp/downloaded-sticker-persisted");
        const firstBotMessageHandler = firstBot!.handlers.get("message")?.[0];
        const sticker = { file_id: "sticker-persisted", is_animated: false, is_video: false };
        await firstBotMessageHandler?.({
            message_id: 61,
            chat: { id: 123, type: "private" },
            from: { id: 123 },
            sticker
        });
        await firstConnector.shutdown("test");

        const secondFileStore = {
            saveFromPath: vi.fn(async (input: { name: string; mimeType: string; path: string }) => ({
                id: "f-sticker-second",
                name: input.name,
                mimeType: input.mimeType,
                path: "/tmp/stored-sticker-second.webp",
                size: 902
            }))
        } as unknown as FileFolder;
        const secondConnector = new TelegramConnector({
            token: "token",
            allowedUids: ["123"],
            polling: false,
            clearWebhook: false,
            statePath,
            fileStore: secondFileStore,
            dataDir: tempDir,
            enableGracefulShutdown: false
        });
        const secondMessageHandler = vi.fn(async (_message, _context, _descriptor) => undefined);
        secondConnector.onMessage(secondMessageHandler);
        await (secondConnector as unknown as { loadState: () => Promise<void> }).loadState();

        const secondBot = telegramInstances[1];
        expect(secondBot).toBeTruthy();
        secondBot!.downloadFile.mockResolvedValue("/tmp/downloaded-sticker-should-not-happen");
        const secondBotMessageHandler = secondBot!.handlers.get("message")?.[0];
        await secondBotMessageHandler?.({
            message_id: 62,
            chat: { id: 123, type: "private" },
            from: { id: 123 },
            sticker
        });

        expect(secondMessageHandler).toHaveBeenCalledTimes(1);
        const [message] = secondMessageHandler.mock.calls[0] as [
            { files?: Array<{ id: string; name: string; mimeType: string; path: string; size: number }> },
            MessageContext,
            string
        ];
        expect(message.files).toEqual([
            {
                id: "f-sticker-persisted",
                name: "sticker-sticker-persisted.webp",
                mimeType: "image/webp",
                path: "/tmp/stored-sticker-persisted.webp",
                size: 901
            }
        ]);
        expect(secondBot!.downloadFile).not.toHaveBeenCalled();
        expect(secondFileStore.saveFromPath).not.toHaveBeenCalled();

        await secondConnector.shutdown("test");
        await fs.rm(tempDir, { recursive: true, force: true });
    });
});

describe("TelegramConnector access mode", () => {
    beforeEach(() => {
        telegramInstances.length = 0;
    });

    it("sends a rejection message for unapproved users in private mode", async () => {
        const fileStore = { saveFromPath: vi.fn() } as unknown as FileFolder;
        const connector = new TelegramConnector({
            token: "token",
            mode: "private",
            allowedUids: ["123"],
            polling: false,
            clearWebhook: false,
            statePath: null,
            fileStore,
            dataDir: "/tmp",
            enableGracefulShutdown: false
        });
        const messageHandler = vi.fn(async (_message, _context, _descriptor) => undefined);
        connector.onMessage(messageHandler);

        const bot = telegramInstances[0];
        expect(bot).toBeTruthy();
        const botMessageHandler = bot!.handlers.get("message")?.[0];
        await botMessageHandler?.({
            message_id: 77,
            chat: { id: 999, type: "private" },
            from: { id: 999 },
            text: "hello"
        });

        expect(messageHandler).not.toHaveBeenCalled();
        expect(bot!.sendMessage).toHaveBeenCalledTimes(1);
        expect(bot!.sendMessage).toHaveBeenCalledWith(
            "999",
            "🚫 You are not authorized to use this bot. Please contact the system administrator to request access."
        );
    });

    it("allows all users in public mode", async () => {
        const fileStore = { saveFromPath: vi.fn() } as unknown as FileFolder;
        const connector = new TelegramConnector({
            token: "token",
            mode: "public",
            allowedUids: ["123"],
            polling: false,
            clearWebhook: false,
            statePath: null,
            fileStore,
            dataDir: "/tmp",
            enableGracefulShutdown: false
        });
        const messageHandler = vi.fn(async (_message, _context, _descriptor) => undefined);
        connector.onMessage(messageHandler);

        const bot = telegramInstances[0];
        expect(bot).toBeTruthy();
        const botMessageHandler = bot!.handlers.get("message")?.[0];
        await botMessageHandler?.({
            message_id: 88,
            chat: { id: 999, type: "private" },
            from: { id: 999 },
            text: "hello"
        });

        expect(messageHandler).toHaveBeenCalledTimes(1);
        expect(bot!.sendMessage).not.toHaveBeenCalled();
    });
});

describe("TelegramConnector startup", () => {
    beforeEach(() => {
        telegramInstances.length = 0;
    });

    it("does not register slash commands before command sync starts", async () => {
        const fileStore = { saveFromPath: vi.fn() } as unknown as FileFolder;
        new TelegramConnector({
            token: "token",
            allowedUids: ["123"],
            polling: false,
            clearWebhook: false,
            statePath: null,
            fileStore,
            dataDir: "/tmp",
            enableGracefulShutdown: false
        });

        await Promise.resolve();

        const bot = telegramInstances[0];
        expect(bot).toBeTruthy();
        expect(bot!.setMyCommands).not.toHaveBeenCalled();
    });
});

describe("TelegramConnector command updates", () => {
    beforeEach(() => {
        telegramInstances.length = 0;
    });

    it("debounces setMyCommands updates by 1 second", async () => {
        vi.useFakeTimers();
        try {
            const fileStore = { saveFromPath: vi.fn() } as unknown as FileFolder;
            const connector = new TelegramConnector({
                token: "token",
                allowedUids: ["123"],
                polling: false,
                clearWebhook: false,
                statePath: null,
                fileStore,
                dataDir: "/tmp",
                enableGracefulShutdown: false
            });
            const bot = telegramInstances[0];
            expect(bot).toBeTruthy();

            connector.updateCommands([{ command: "reset", description: "Reset the current conversation." }]);
            await vi.advanceTimersByTimeAsync(1000);
            expect(bot!.setMyCommands).not.toHaveBeenCalled();

            connector.commandSyncStart();
            connector.updateCommands([{ command: "reset", description: "Reset the current conversation." }]);
            connector.updateCommands([
                { command: "reset", description: "Reset the current conversation." },
                { command: "upgrade", description: "Upgrade daycare to latest version" }
            ]);

            await vi.advanceTimersByTimeAsync(999);
            expect(bot!.setMyCommands).not.toHaveBeenCalled();

            await vi.advanceTimersByTimeAsync(1);
            expect(bot!.setMyCommands).toHaveBeenCalledTimes(1);
            expect(bot!.setMyCommands).toHaveBeenCalledWith(
                [
                    {
                        command: "reset",
                        description: "Reset the current conversation."
                    },
                    {
                        command: "upgrade",
                        description: "Upgrade daycare to latest version"
                    }
                ],
                {
                    scope: {
                        type: "all_private_chats"
                    }
                }
            );
            expect(bot!.setChatMenuButton).toHaveBeenCalledTimes(1);
            expect(bot!.setChatMenuButton).toHaveBeenCalledWith({
                menu_button: {
                    type: "commands"
                }
            });

            await connector.shutdown("test");
        } finally {
            vi.useRealTimers();
        }
    });

    it("sets a WebApp menu button when webAppUrl is configured", async () => {
        vi.useFakeTimers();
        try {
            const fileStore = { saveFromPath: vi.fn() } as unknown as FileFolder;
            const connector = new TelegramConnector({
                token: "token",
                allowedUids: ["123"],
                polling: false,
                clearWebhook: false,
                statePath: null,
                webAppUrl: "https://app.example.com/?backend=https%3A%2F%2Fapi.example.com",
                fileStore,
                dataDir: "/tmp",
                enableGracefulShutdown: false
            });
            const bot = telegramInstances[0];
            expect(bot).toBeTruthy();

            connector.commandSyncStart();
            connector.updateCommands([{ command: "app", description: "Open app" }]);

            await vi.advanceTimersByTimeAsync(1000);
            expect(bot!.setChatMenuButton).toHaveBeenCalledTimes(1);
            expect(bot!.setChatMenuButton).toHaveBeenCalledWith({
                menu_button: {
                    type: "web_app",
                    text: "Open Daycare",
                    web_app: {
                        url: "https://app.example.com/?backend=https%3A%2F%2Fapi.example.com"
                    }
                }
            });

            await connector.shutdown("test");
        } finally {
            vi.useRealTimers();
        }
    });
});

describe("TelegramConnector polling", () => {
    beforeEach(() => {
        telegramInstances.length = 0;
    });

    it("clears the webhook on polling conflict without local retry", async () => {
        const fileStore = { saveFromPath: vi.fn() } as unknown as FileFolder;
        const connector = new TelegramConnector({
            token: "token",
            allowedUids: ["123"],
            polling: false,
            clearWebhook: false,
            statePath: null,
            fileStore,
            dataDir: "/tmp",
            enableGracefulShutdown: false
        });

        const bot = telegramInstances[0];
        expect(bot).toBeTruthy();

        const pollingErrorHandler = bot!.handlers.get("polling_error")?.[0];
        expect(pollingErrorHandler).toBeTruthy();

        bot!.deleteWebHook.mockClear();
        bot!.startPolling.mockClear();

        pollingErrorHandler?.({ code: "ETELEGRAM", response: { statusCode: 409 } });
        await Promise.resolve();

        expect(bot!.deleteWebHook).toHaveBeenCalledTimes(1);
        expect(bot!.startPolling).not.toHaveBeenCalled();
        void connector;
    });
});

describe("TelegramConnector file uploads", () => {
    beforeEach(() => {
        telegramInstances.length = 0;
    });

    it("sends explicit contentType and filename for document uploads", async () => {
        const fileStore = { saveFromPath: vi.fn() } as unknown as FileFolder;
        const connector = new TelegramConnector({
            token: "token",
            allowedUids: ["123"],
            polling: false,
            clearWebhook: false,
            statePath: null,
            fileStore,
            dataDir: "/tmp",
            enableGracefulShutdown: false
        });

        await connector.sendMessage("123", {
            text: "Here's the file",
            files: [
                {
                    id: "f-1",
                    name: "report.txt",
                    mimeType: "text/plain",
                    size: 12,
                    path: "/tmp/file-without-extension",
                    sendAs: "document"
                }
            ]
        });

        const bot = telegramInstances[0];
        expect(bot).toBeTruthy();
        expect(bot!.sendDocument).toHaveBeenCalledTimes(1);
        const call = bot!.sendDocument.mock.calls[0];
        expect(call?.[3]).toMatchObject({
            filename: "report.txt",
            contentType: "text/plain"
        });
    });

    it("sends explicit contentType and filename for voice uploads", async () => {
        const fileStore = { saveFromPath: vi.fn() } as unknown as FileFolder;
        const connector = new TelegramConnector({
            token: "token",
            allowedUids: ["123"],
            polling: false,
            clearWebhook: false,
            statePath: null,
            fileStore,
            dataDir: "/tmp",
            enableGracefulShutdown: false
        });

        await connector.sendMessage("123", {
            text: "Voice note",
            files: [
                {
                    id: "f-voice-1",
                    name: "voice-note.ogg",
                    mimeType: "audio/ogg",
                    size: 64,
                    path: "/tmp/voice-note.ogg",
                    sendAs: "voice"
                }
            ]
        });

        const bot = telegramInstances[0];
        expect(bot).toBeTruthy();
        expect(bot!.sendVoice).toHaveBeenCalledTimes(1);
        const call = bot!.sendVoice.mock.calls[0];
        expect(call?.[3]).toMatchObject({
            filename: "voice-note.ogg",
            contentType: "audio/ogg"
        });
    });

    it("sends inline URL buttons for text messages", async () => {
        const fileStore = { saveFromPath: vi.fn() } as unknown as FileFolder;
        const connector = new TelegramConnector({
            token: "token",
            allowedUids: ["123"],
            sendReplies: true,
            polling: false,
            clearWebhook: false,
            statePath: null,
            fileStore,
            dataDir: "/tmp",
            enableGracefulShutdown: false
        });

        await connector.sendMessage("123", {
            text: "Use button below to authenticate.",
            replyToMessageId: "77",
            buttons: [
                {
                    text: "Open Daycare",
                    url: "https://app.example.com/auth#token"
                }
            ]
        });

        const bot = telegramInstances[0];
        expect(bot).toBeTruthy();
        expect(bot!.sendMessage).toHaveBeenCalledTimes(1);
        const sendCall = bot!.sendMessage.mock.calls[0];
        expect(sendCall?.[0]).toBe("123");
        expect(typeof sendCall?.[1]).toBe("string");
        expect((sendCall?.[1] as string).trim()).toBe("Use button below to authenticate.");
        expect(sendCall?.[2]).toMatchObject({
            parse_mode: "HTML",
            reply_to_message_id: 77,
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: "Open Daycare",
                            url: "https://app.example.com/auth#token"
                        }
                    ]
                ]
            }
        });
    });

    it("does not send reply_to_message_id for private targets by default", async () => {
        const fileStore = { saveFromPath: vi.fn() } as unknown as FileFolder;
        const connector = new TelegramConnector({
            token: "token",
            allowedUids: ["123"],
            polling: false,
            clearWebhook: false,
            statePath: null,
            fileStore,
            dataDir: "/tmp",
            enableGracefulShutdown: false
        });

        await connector.sendMessage("123", {
            text: "Use button below to authenticate.",
            replyToMessageId: "77",
            buttons: [
                {
                    text: "Open Daycare",
                    url: "https://app.example.com/auth#token"
                }
            ]
        });

        const bot = telegramInstances[0];
        expect(bot).toBeTruthy();
        expect(bot!.sendMessage).toHaveBeenCalledTimes(1);
        const sendCall = bot!.sendMessage.mock.calls[0];
        expect(sendCall?.[2]).toMatchObject({
            parse_mode: "HTML",
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: "Open Daycare",
                            url: "https://app.example.com/auth#token"
                        }
                    ]
                ]
            }
        });
        expect(sendCall?.[2]).not.toHaveProperty("reply_to_message_id");
    });

    it("sends reply_to_message_id for group targets when group replies are enabled", async () => {
        const fileStore = { saveFromPath: vi.fn() } as unknown as FileFolder;
        const connector = new TelegramConnector({
            token: "token",
            mode: "public",
            allowedUids: ["123"],
            sendReplies: false,
            sendRepliesInGroups: true,
            polling: false,
            clearWebhook: false,
            statePath: null,
            fileStore,
            dataDir: "/tmp",
            enableGracefulShutdown: false
        });

        await connector.sendMessage("-100123", {
            text: "Group reply",
            replyToMessageId: "77"
        });

        const bot = telegramInstances[0];
        expect(bot).toBeTruthy();
        expect(bot!.sendMessage).toHaveBeenCalledTimes(1);
        const sendCall = bot!.sendMessage.mock.calls[0];
        expect(sendCall?.[2]).toMatchObject({
            parse_mode: "HTML",
            reply_to_message_id: 77
        });
    });
});
