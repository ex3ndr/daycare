import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentDescriptor, MessageContext } from "@/types";
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
        const [command, context, descriptor] = commandHandler.mock.calls[0] as [
            string,
            MessageContext,
            AgentDescriptor
        ];
        expect(command).toBe("/reset");
        expect(context).toMatchObject({ messageId: "55" });
        expect(descriptor).toMatchObject({
            type: "user",
            connector: "telegram",
            channelId: "123",
            userId: "123"
        });
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
        const [message, context, descriptor] = messageHandlerMock.mock.calls[0] as [
            { text: string | null; files?: Array<{ name: string; mimeType: string; path: string; size: number }> },
            MessageContext,
            AgentDescriptor
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
        expect(descriptor).toMatchObject({
            type: "user",
            connector: "telegram",
            channelId: "123",
            userId: "123"
        });
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
            AgentDescriptor
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
        const [message, context, descriptor] = messageHandlerMock.mock.calls[0] as [
            { text: string | null; files?: Array<{ name: string; mimeType: string; path: string; size: number }> },
            MessageContext,
            AgentDescriptor
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
        expect(descriptor).toMatchObject({
            type: "user",
            connector: "telegram",
            channelId: "123",
            userId: "123"
        });
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
            AgentDescriptor
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
                webAppUrl: "https://app.example.com/auth?backend=https%3A%2F%2Fapi.example.com",
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
                        url: "https://app.example.com/auth?backend=https%3A%2F%2Fapi.example.com"
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
});
