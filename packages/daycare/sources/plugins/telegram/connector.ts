import { promises as fs } from "node:fs";
import path from "node:path";

import TelegramBot from "node-telegram-bot-api";

import type {
    AgentDescriptor,
    CommandHandler,
    Connector,
    ConnectorCapabilities,
    ConnectorFile,
    ConnectorMessage,
    FileReference,
    MessageContext,
    MessageHandler,
    SlashCommandEntry
} from "@/types";
import type { FileFolder } from "../../engine/files/fileFolder.js";
import { getLogger } from "../../log.js";
import { markdownToTelegramHtml } from "./markdownToTelegramHtml.js";
import { telegramMessageSplit } from "./telegramMessageSplit.js";

export type TelegramConnectorOptions = {
    token: string;
    allowedUids: string[];
    mode?: "public" | "private";
    polling?: boolean;
    clearWebhook?: boolean;
    statePath?: string | null;
    fileStore: FileFolder;
    dataDir: string;
    enableGracefulShutdown?: boolean;
    onFatal?: (reason: string, error?: unknown) => void;
};

const logger = getLogger("plugin.telegram");

const TELEGRAM_MESSAGE_FORMAT_PROMPT = [
    "Format messages using GitHub-flavored markdown (GFM).",
    "Supported: **bold**, *italic*, ~~strikethrough~~, `inline code`, ```code blocks``` (with optional language), [links](url), > blockquotes, and lists (- or 1.).",
    "Headers (# Title) render as bold text.",
    "Tables render as plain text.",
    "Task lists (- [x] item) render with checkbox symbols.",
    "Do NOT use raw HTML tags; they will be escaped.",
    "Keep formatting simple and well-nested."
].join(" ");

const TELEGRAM_MESSAGE_MAX_LENGTH = 4096;
const TELEGRAM_CAPTION_MAX_LENGTH = 1024;
const TELEGRAM_COMMAND_UPDATE_DEBOUNCE_MS = 1000;
const TELEGRAM_UNAUTHORIZED_MESSAGE =
    "🚫 You are not authorized to use this bot. Please contact the system administrator to request access.";

export class TelegramConnector implements Connector {
    capabilities: ConnectorCapabilities = {
        sendText: true,
        sendFiles: {
            modes: ["document", "photo", "video"]
        },
        messageFormatPrompt: TELEGRAM_MESSAGE_FORMAT_PROMPT,
        reactions: true,
        typing: true
    };
    private bot: TelegramBot;
    private handlers: MessageHandler[] = [];
    private commandHandlers: CommandHandler[] = [];
    private pollingEnabled: boolean;
    private statePath: string | null;
    private lastUpdateId: number | null = null;
    private fileStore: FileFolder;
    private dataDir: string;
    private persistTimer: NodeJS.Timeout | null = null;
    private typingTimers = new Map<string, NodeJS.Timeout>();
    private startingPolling = false;
    private commandSyncEnabled = false;
    private pendingCommands: SlashCommandEntry[] = [];
    private commandSyncTimer: NodeJS.Timeout | null = null;
    private allowedUids: Set<string>;
    private mode: "public" | "private";
    private shuttingDown = false;
    private clearWebhookOnStart: boolean;
    private clearedWebhook = false;

    constructor(options: TelegramConnectorOptions) {
        logger.debug(
            `init: TelegramConnector constructor polling=${options.polling} clearWebhook=${options.clearWebhook} dataDir=${options.dataDir}`
        );
        this.pollingEnabled = options.polling ?? true;
        this.clearWebhookOnStart = options.clearWebhook ?? true;
        this.fileStore = options.fileStore;
        this.dataDir = options.dataDir;
        this.mode = options.mode ?? "private";
        this.allowedUids = new Set(options.allowedUids.map((uid) => String(uid)));
        this.statePath =
            options.statePath === undefined ? path.join(this.dataDir, "telegram-offset.json") : options.statePath;
        if (this.statePath) {
            this.statePath = path.resolve(this.statePath);
        }
        logger.debug(`event: State path configured statePath=${this.statePath} pollingEnabled=${this.pollingEnabled}`);

        this.bot = new TelegramBot(options.token, { polling: false });
        logger.debug("create: TelegramBot instance created");

        const originalProcessUpdate = this.bot.processUpdate.bind(this.bot);
        this.bot.processUpdate = (update: TelegramBot.Update) => {
            logger.debug(`update: Processing Telegram update updateId=${update.update_id}`);
            this.trackUpdate(update);
            return originalProcessUpdate(update);
        };

        this.bot.on("message", async (message) => {
            const chatType = message.chat?.type;
            if (chatType !== "private" && chatType !== "group" && chatType !== "supergroup") {
                logger.debug(`skip: Skipping unsupported chat type=${chatType} chatId=${message.chat?.id}`);
                return;
            }
            const senderId = message.from?.id ?? message.chat?.id;
            if (!this.isAllowedUid(senderId)) {
                logger.info(
                    { senderId, chatId: message.chat?.id },
                    "skip: Skipping telegram message from unapproved uid"
                );
                if (this.mode === "private") {
                    await this.bot.sendMessage(String(message.chat.id), TELEGRAM_UNAUTHORIZED_MESSAGE);
                }
                return;
            }
            logger.debug(
                `receive: Received Telegram message chatId=${message.chat.id} fromId=${message.from?.id} messageId=${message.message_id} hasText=${!!message.text} hasCaption=${!!message.caption} hasPhoto=${!!message.photo} hasDocument=${!!message.document}`
            );
            const rawText = typeof message.text === "string" ? message.text : null;
            const trimmedText = rawText?.trim() ?? "";
            const isCommand = trimmedText.startsWith("/");

            const descriptor: AgentDescriptor = {
                type: "user",
                connector: "telegram",
                userId: String(message.from?.id ?? message.chat.id),
                channelId: String(message.chat.id)
            };
            const context: MessageContext = {
                messageId: message.message_id ? String(message.message_id) : undefined
            };

            if (isCommand && rawText) {
                logger.debug(
                    `event: Dispatching to command handlers handlerCount=${this.commandHandlers.length} channelId=${descriptor.channelId}`
                );
                for (const handler of this.commandHandlers) {
                    await handler(rawText, context, descriptor);
                }
                logger.debug(`event: All command handlers completed channelId=${descriptor.channelId}`);
                return;
            }

            const files = await this.extractFiles(message);
            logger.debug(`event: Extracted files from message fileCount=${files.length}`);
            const documentNoticeText = this.documentNoticeText(message, files);
            const payload: ConnectorMessage = {
                text: rawText ?? message.caption ?? documentNoticeText,
                files: files.length > 0 ? files : undefined
            };

            logger.debug(
                `event: Dispatching to handlers handlerCount=${this.handlers.length} channelId=${descriptor.channelId}`
            );
            for (const handler of this.handlers) {
                await handler(payload, context, descriptor);
            }
            logger.debug(`event: All handlers completed channelId=${descriptor.channelId}`);
        });

        this.bot.on("polling_error", (error) => {
            if (this.shuttingDown) {
                return;
            }
            this.handlePollingError(error);
        });

        if (options.enableGracefulShutdown ?? true) {
            this.attachSignalHandlers();
        }

        void this.initialize();
    }

    onMessage(handler: MessageHandler): () => void {
        this.handlers.push(handler);
        return () => {
            const index = this.handlers.indexOf(handler);
            if (index !== -1) {
                this.handlers.splice(index, 1);
            }
        };
    }

    onCommand(handler: CommandHandler): () => void {
        this.commandHandlers.push(handler);
        return () => {
            const index = this.commandHandlers.indexOf(handler);
            if (index !== -1) {
                this.commandHandlers.splice(index, 1);
            }
        };
    }

    botGet(): TelegramBot {
        return this.bot;
    }

    updateCommands(commands: SlashCommandEntry[]): void {
        this.pendingCommands = commands;
        if (!this.commandSyncEnabled) {
            return;
        }
        this.scheduleCommandSync();
    }

    commandSyncStart(): void {
        this.commandSyncEnabled = true;
        this.scheduleCommandSync();
    }

    async sendMessage(targetId: string, message: ConnectorMessage): Promise<void> {
        logger.debug(
            `event: sendMessage() called targetId=${targetId} hasText=${!!message.text} textLength=${message.text?.length ?? 0} fileCount=${message.files?.length ?? 0}`
        );
        if (!this.isAllowedTarget(targetId, "sendMessage")) {
            return;
        }
        const files = message.files ?? [];
        if (files.length === 0) {
            logger.debug(`send: Sending text-only message targetId=${targetId}`);
            await this.sendTextWithFallback(targetId, message.text ?? "");
            logger.debug(`send: Text message sent targetId=${targetId}`);
            return;
        }

        const first = files[0];
        if (!first) {
            logger.debug("event: No first file found, returning");
            return;
        }
        const rest = files.slice(1);
        const caption = message.text ?? undefined;
        const captionChunks = caption ? telegramMessageSplit(caption, TELEGRAM_CAPTION_MAX_LENGTH) : [];
        const sendCaption = captionChunks.length === 1 ? captionChunks[0] : undefined;
        if (!sendCaption && caption) {
            logger.debug(
                `send: Caption too long for Telegram; sending as separate message targetId=${targetId} captionLength=${caption.length}`
            );
        }
        logger.debug(
            `send: Sending first file targetId=${targetId} fileName=${first.name} mimeType=${first.mimeType} hasCaption=${!!sendCaption}`
        );
        await this.sendFile(targetId, first, sendCaption);
        for (const file of rest) {
            logger.debug(
                `send: Sending additional file targetId=${targetId} fileName=${file.name} mimeType=${file.mimeType}`
            );
            await this.sendFile(targetId, file);
        }
        if (!sendCaption && caption) {
            await this.sendTextWithFallback(targetId, caption);
        }
        logger.debug(`send: All files sent targetId=${targetId} totalFiles=${files.length}`);
    }

    startTyping(targetId: string): () => void {
        if (!this.isAllowedTarget(targetId, "startTyping")) {
            return () => undefined;
        }
        const key = String(targetId);
        if (this.typingTimers.has(key)) {
            return () => {
                this.stopTyping(key);
            };
        }

        const send = () => {
            void this.bot.sendChatAction(targetId, "typing").catch((error) => {
                logger.warn({ error }, "error: Telegram typing failed");
            });
        };

        send();
        const timer = setInterval(send, 4000);
        this.typingTimers.set(key, timer);

        return () => {
            this.stopTyping(key);
        };
    }

    async setReaction(targetId: string, messageId: string, reaction: string): Promise<void> {
        if (!this.isAllowedTarget(targetId, "setReaction")) {
            return;
        }
        const emoji = reaction as TelegramBot.TelegramEmoji;
        await this.bot.setMessageReaction(targetId, Number(messageId), {
            reaction: [{ type: "emoji", emoji }]
        });
    }

    private async sendFile(targetId: string, file: ConnectorFile, caption?: string): Promise<void> {
        const htmlCaption = caption ? markdownToTelegramHtml(caption) : undefined;
        const useHtmlCaption = !!htmlCaption && htmlCaption.length <= TELEGRAM_CAPTION_MAX_LENGTH;
        const options = useHtmlCaption
            ? { caption: htmlCaption, parse_mode: "HTML" as TelegramBot.ParseMode }
            : caption
              ? { caption }
              : undefined;
        const sendAs = file.sendAs ?? "auto";
        try {
            await this.sendFileWithOptions(targetId, file, sendAs, options);
        } catch (error) {
            if (!caption || !useHtmlCaption || !isTelegramParseError(error)) {
                throw error;
            }
            logger.warn({ error }, "error: Telegram HTML caption parse error; retrying without parse_mode");
            await this.sendFileWithOptions(targetId, file, sendAs, { caption });
        }
    }

    private async sendTextWithFallback(targetId: string, text: string): Promise<void> {
        const chunks = telegramMessageSplit(text, TELEGRAM_MESSAGE_MAX_LENGTH);
        for (const chunk of chunks) {
            await this.sendTextChunk(targetId, chunk);
        }
    }

    private async sendTextChunk(targetId: string, text: string): Promise<void> {
        const html = markdownToTelegramHtml(text);
        const useHtml = html.length <= TELEGRAM_MESSAGE_MAX_LENGTH;
        try {
            if (useHtml) {
                await this.bot.sendMessage(targetId, html, {
                    parse_mode: "HTML"
                });
                return;
            }
            await this.bot.sendMessage(targetId, text);
        } catch (error) {
            if (!useHtml || !isTelegramParseError(error)) {
                throw error;
            }
            logger.warn({ error }, "error: Telegram HTML parse error; retrying without parse_mode");
            await this.bot.sendMessage(targetId, text);
        }
    }

    private async sendFileWithOptions(
        targetId: string,
        file: ConnectorFile,
        sendAs: ConnectorFile["sendAs"] | "auto",
        options?: TelegramBot.SendPhotoOptions | TelegramBot.SendVideoOptions | TelegramBot.SendDocumentOptions
    ): Promise<void> {
        const fileOptions: TelegramBot.FileOptions = {
            filename: file.name,
            contentType: file.mimeType
        };

        if (sendAs === "photo") {
            await this.bot.sendPhoto(targetId, file.path, options, fileOptions);
            return;
        }
        if (sendAs === "video") {
            await this.bot.sendVideo(targetId, file.path, options, fileOptions);
            return;
        }
        if (sendAs === "document") {
            await this.bot.sendDocument(targetId, file.path, options, fileOptions);
            return;
        }
        if (file.mimeType.startsWith("image/")) {
            await this.bot.sendPhoto(targetId, file.path, options, fileOptions);
            return;
        }
        if (file.mimeType.startsWith("video/")) {
            await this.bot.sendVideo(targetId, file.path, options, fileOptions);
            return;
        }
        await this.bot.sendDocument(targetId, file.path, options, fileOptions);
    }

    private async initialize(): Promise<void> {
        logger.debug(
            `init: initialize() starting pollingEnabled=${this.pollingEnabled} clearWebhookOnStart=${this.clearWebhookOnStart}`
        );
        if (this.pollingEnabled && this.clearWebhookOnStart) {
            logger.debug("event: Clearing webhook before polling");
            await this.ensureWebhookCleared();
        }
        logger.debug("load: Loading state");
        await this.loadState();
        if (this.pollingEnabled) {
            logger.debug("start: Starting polling");
            await this.startPolling();
        }
        logger.debug("init: initialize() complete");
    }

    private trackUpdate(update: TelegramBot.Update): void {
        if (typeof update.update_id !== "number") {
            return;
        }

        if (this.lastUpdateId === null || update.update_id > this.lastUpdateId) {
            this.lastUpdateId = update.update_id;
            this.schedulePersist();
        }
    }

    private async loadState(): Promise<void> {
        if (!this.statePath) {
            return;
        }

        try {
            const content = await fs.readFile(this.statePath, "utf8");
            const trimmed = content.trim();
            if (!trimmed) {
                return;
            }
            try {
                const parsed = JSON.parse(trimmed) as { lastUpdateId?: number };
                if (typeof parsed.lastUpdateId === "number") {
                    this.lastUpdateId = parsed.lastUpdateId;
                }
                return;
            } catch (error) {
                const recovered = recoverLastUpdateId(trimmed);
                if (recovered !== null) {
                    this.lastUpdateId = recovered;
                    logger.warn(
                        { statePath: this.statePath, lastUpdateId: recovered },
                        "event: Telegram connector state was invalid JSON; recovered lastUpdateId"
                    );
                    await this.persistState();
                    return;
                }
                await this.quarantineStateFile();
                logger.warn({ error, statePath: this.statePath }, "error: Telegram connector state load failed");
            }
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
                logger.warn({ error, statePath: this.statePath }, "error: Telegram connector state load failed");
            }
        }
    }

    private schedulePersist(): void {
        if (!this.statePath || this.persistTimer) {
            return;
        }

        this.persistTimer = setTimeout(() => {
            void this.persistState();
        }, 500);
    }

    private async persistState(): Promise<void> {
        if (!this.statePath || this.lastUpdateId === null) {
            return;
        }

        if (this.persistTimer) {
            clearTimeout(this.persistTimer);
            this.persistTimer = null;
        }

        try {
            await fs.mkdir(path.dirname(this.statePath), { recursive: true });
            const payload = JSON.stringify({ lastUpdateId: this.lastUpdateId });
            const tmpPath = `${this.statePath}.tmp-${process.pid}-${Date.now()}`;
            await fs.writeFile(tmpPath, payload, "utf8");
            await fs.rename(tmpPath, this.statePath);
        } catch (error) {
            logger.warn({ error, statePath: this.statePath }, "error: Telegram connector state persist failed");
        }
    }

    private async quarantineStateFile(): Promise<void> {
        if (!this.statePath) {
            return;
        }
        try {
            const dir = path.dirname(this.statePath);
            const name = path.basename(this.statePath);
            const target = path.join(dir, `${name}.corrupt-${Date.now()}`);
            await fs.rename(this.statePath, target);
            logger.warn(
                { statePath: this.statePath, quarantinePath: target },
                "event: Telegram state file quarantined"
            );
        } catch (error) {
            logger.warn({ error, statePath: this.statePath }, "error: Failed to quarantine telegram state file");
        }
    }

    private async startPolling(): Promise<void> {
        logger.debug(
            `event: startPolling() called pollingEnabled=${this.pollingEnabled} isPolling=${this.bot.isPolling()}`
        );
        if (!this.pollingEnabled) {
            logger.debug("event: Polling disabled, returning");
            return;
        }

        if (this.startingPolling) {
            logger.debug("start: Polling start already in progress, returning");
            return;
        }

        if (this.bot.isPolling()) {
            logger.debug("event: Already polling, returning");
            return;
        }

        const pollingOptions: TelegramBot.PollingOptions = {
            autoStart: true,
            params: {}
        };

        if (this.lastUpdateId !== null) {
            pollingOptions.params = {
                offset: this.lastUpdateId + 1
            };
            logger.debug(`update: Resuming from last update ID offset=${this.lastUpdateId + 1}`);
        }

        this.startingPolling = true;
        try {
            logger.debug("start: Starting Telegram polling");
            await this.bot.startPolling({
                restart: true,
                polling: pollingOptions
            });
            if (this.shuttingDown || !this.pollingEnabled) {
                logger.debug("start: Polling disabled after start, stopping");
                await this.stopPolling("disabled");
                return;
            }
            logger.debug("start: Telegram polling started successfully");
        } catch (error) {
            this.handlePollingError(error);
        } finally {
            this.startingPolling = false;
        }
    }

    private handlePollingError(error: unknown): void {
        if (isTelegramConflictError(error) && !this.clearedWebhook) {
            logger.warn({ error }, "event: Telegram polling conflict; clearing webhook");
            void this.ensureWebhookCleared();
            return;
        }

        logger.warn({ error }, "error: Telegram polling error; relying on library restart");
    }

    private isAllowedUid(uid: string | number | null | undefined): boolean {
        if (this.mode === "public") {
            return true;
        }
        if (uid === null || uid === undefined) {
            return false;
        }
        return this.allowedUids.has(String(uid));
    }

    private isAllowedTarget(targetId: string, action: string): boolean {
        if (this.isAllowedUid(targetId)) {
            return true;
        }
        logger.warn({ targetId, action }, "event: Blocked telegram action for unapproved uid");
        return false;
    }

    private attachSignalHandlers(): void {
        const handler = (signal: NodeJS.Signals) => {
            void this.shutdown(signal);
        };

        process.once("SIGINT", handler);
        process.once("SIGTERM", handler);
    }

    async shutdown(reason: string = "shutdown"): Promise<void> {
        logger.debug(`event: shutdown() called reason=${reason} alreadyShuttingDown=${this.shuttingDown}`);
        if (this.shuttingDown) {
            logger.debug("event: Already shutting down, returning");
            return;
        }

        this.shuttingDown = true;
        logger.debug("event: Beginning shutdown sequence");

        if (this.persistTimer) {
            logger.debug("event: Clearing persist timer");
            clearTimeout(this.persistTimer);
            this.persistTimer = null;
        }
        if (this.commandSyncTimer) {
            logger.debug("event: Clearing command sync timer");
            clearTimeout(this.commandSyncTimer);
            this.commandSyncTimer = null;
        }
        logger.debug(`event: Clearing typing timers typingTimerCount=${this.typingTimers.size}`);
        for (const timer of this.typingTimers.values()) {
            clearInterval(timer);
        }
        this.typingTimers.clear();

        try {
            logger.debug("stop: Stopping polling");
            await this.bot.stopPolling({ cancel: true, reason });
            logger.debug("stop: Polling stopped");
        } catch (error) {
            logger.warn({ error }, "error: Telegram polling stop failed");
        }

        logger.debug("event: Persisting state");
        await this.persistState();
        logger.debug("event: Shutdown complete");
    }

    private async stopPolling(reason: string): Promise<void> {
        try {
            if (this.bot.isPolling()) {
                await this.bot.stopPolling({ cancel: true, reason });
            }
        } catch (error) {
            logger.warn({ error }, "error: Telegram polling stop failed");
        }
    }

    private async ensureWebhookCleared(): Promise<void> {
        if (this.clearedWebhook) {
            return;
        }

        try {
            await this.bot.deleteWebHook();
            this.clearedWebhook = true;
            logger.info("event: Telegram webhook cleared for polling");
        } catch (error) {
            logger.warn({ error }, "error: Failed to clear Telegram webhook");
        }
    }

    private stopTyping(key: string): void {
        const timer = this.typingTimers.get(key);
        if (!timer) {
            return;
        }
        clearInterval(timer);
        this.typingTimers.delete(key);
    }

    private async extractFiles(message: TelegramBot.Message): Promise<FileReference[]> {
        const files: FileReference[] = [];
        if (message.photo && message.photo.length > 0) {
            const largest = message.photo.reduce((prev, current) =>
                (current.file_size ?? 0) > (prev.file_size ?? 0) ? current : prev
            );
            const stored = await this.downloadFile(largest.file_id, `photo-${largest.file_id}.jpg`, "image/jpeg");
            if (stored) {
                files.push(stored);
            }
        }

        if (message.document?.file_id) {
            const stored = await this.downloadFile(
                message.document.file_id,
                message.document.file_name ?? `document-${message.document.file_id}`,
                message.document.mime_type ?? "application/octet-stream"
            );
            if (stored) {
                files.push(stored);
            }
        }

        return files;
    }

    private documentNoticeText(message: TelegramBot.Message, files: FileReference[]): string | null {
        if (!message.document?.file_id) {
            return null;
        }
        const fileName = message.document.file_name?.trim();
        if (files.length > 0) {
            if (fileName) {
                return `Document received: ${fileName}.`;
            }
            return "Document received.";
        }
        if (fileName) {
            return `Document received: ${fileName} (download failed).`;
        }
        return "Document received (download failed).";
    }

    private async downloadFile(fileId: string, name: string, mimeType: string): Promise<FileReference | null> {
        const downloadDir = path.join(this.dataDir, "downloads");
        await fs.mkdir(downloadDir, { recursive: true });
        try {
            const downloadedPath = await this.bot.downloadFile(fileId, downloadDir);
            const stored = await this.fileStore.saveFromPath({
                name,
                mimeType,
                path: downloadedPath
            });
            await fs.rm(downloadedPath, { force: true });
            return {
                id: stored.id,
                name: stored.name,
                mimeType: stored.mimeType,
                size: stored.size,
                path: stored.path
            };
        } catch (error) {
            logger.warn({ error }, "error: Telegram file download failed");
            return null;
        }
    }

    private scheduleCommandSync(): void {
        if (this.commandSyncTimer) {
            clearTimeout(this.commandSyncTimer);
            this.commandSyncTimer = null;
        }
        this.commandSyncTimer = setTimeout(() => {
            void this.commandSyncFlush();
        }, TELEGRAM_COMMAND_UPDATE_DEBOUNCE_MS);
    }

    private async commandSyncFlush(): Promise<void> {
        this.commandSyncTimer = null;
        try {
            await this.bot.setMyCommands(
                this.pendingCommands.map((command) => ({
                    command: command.command,
                    description: command.description
                })),
                {
                    scope: {
                        type: "all_private_chats"
                    }
                }
            );
            logger.debug(`register: Telegram slash commands updated commandCount=${this.pendingCommands.length}`);
        } catch (error) {
            logger.warn({ error }, "error: Failed to update Telegram slash commands");
        }
    }
}

function recoverLastUpdateId(content: string): number | null {
    const match = /"lastUpdateId"\s*:\s*(\d+)/.exec(content);
    if (match?.[1]) {
        const value = Number(match[1]);
        return Number.isFinite(value) ? value : null;
    }
    return null;
}

function isTelegramParseError(error: unknown): boolean {
    if (!error || typeof error !== "object") {
        return false;
    }

    const maybe = error as {
        code?: string;
        message?: string;
        response?: { statusCode?: number; body?: { description?: string; error_code?: number } };
    };

    if (maybe.code !== "ETELEGRAM") {
        return false;
    }

    const description = maybe.response?.body?.description ?? maybe.message ?? "";
    if (typeof description !== "string") {
        return false;
    }

    const normalized = description.toLowerCase();
    return normalized.includes("can't parse entities") || normalized.includes("cant parse entities");
}

function isTelegramConflictError(error: unknown): boolean {
    if (!error || typeof error !== "object") {
        return false;
    }

    const maybe = error as {
        code?: string;
        response?: { statusCode?: number; body?: { error_code?: number } };
    };

    const status = maybe.response?.statusCode ?? maybe.response?.body?.error_code;
    return maybe.code === "ETELEGRAM" && status === 409;
}
