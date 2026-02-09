import { promises as fs } from "node:fs";
import path from "node:path";

import makeWASocket, {
  fetchLatestBaileysVersion,
  DisconnectReason,
  type WASocket,
  type BaileysEventMap,
  type proto,
  type AuthenticationState,
  downloadMediaMessage
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import qrcodeTerminal from "qrcode-terminal";

import type {
  Connector,
  ConnectorMessage,
  ConnectorFile,
  ConnectorCapabilities,
  MessageContext,
  MessageHandler,
  CommandHandler,
  AgentDescriptor,
  PermissionDecision,
  PermissionHandler,
  PermissionRequest,
  FileReference
} from "@/types";
import { getLogger } from "../../log.js";
import type { FileStore } from "../../files/store.js";
import type { AuthStore } from "../../auth/store.js";
import { markdownToWhatsAppText } from "./markdownToWhatsAppText.js";
import { useAuthStoreState } from "./authState.js";

export type WhatsAppConnectorOptions = {
  allowedPhones: string[];
  authStore: AuthStore;
  instanceId: string;
  fileStore: FileStore;
  dataDir: string;
  printQRInTerminal?: boolean;
  onQRCode?: (qr: string) => void;
  onFatal?: (reason: string, error?: unknown) => void;
};

const logger = getLogger("plugin.whatsapp");

const WHATSAPP_MESSAGE_FORMAT_PROMPT = [
  "Format messages using GitHub-flavored markdown (GFM).",
  "Supported: **bold**, *italic*, ~~strikethrough~~, `inline code`, ```code blocks```, and lists (- or 1.).",
  "Links render as plain URLs.",
  "Headers (# Title) render as bold text.",
  "Tables render as plain text.",
  "Task lists (- [x] item) render with checkbox symbols.",
  "Keep formatting simple."
].join(" ");

export class WhatsAppConnector implements Connector {
  capabilities: ConnectorCapabilities = {
    sendText: true,
    sendFiles: {
      modes: ["document", "photo", "video"]
    },
    messageFormatPrompt: WHATSAPP_MESSAGE_FORMAT_PROMPT,
    reactions: true,
    typing: true
  };

  private socket: WASocket | null = null;
  private handlers: MessageHandler[] = [];
  private commandHandlers: CommandHandler[] = [];
  private permissionHandlers: PermissionHandler[] = [];
  private allowedPhones: Set<string>;
  private authStore: AuthStore;
  private instanceId: string;
  private fileStore: FileStore;
  private dataDir: string;
  private printQRInTerminal: boolean;
  private onQRCode?: (qr: string) => void;
  private onFatal?: (reason: string, error?: unknown) => void;
  private shuttingDown = false;
  private reconnecting = false;
  private pendingPermissions = new Map<
    string,
    { request: PermissionRequest; context: MessageContext; descriptor: AgentDescriptor }
  >();

  constructor(options: WhatsAppConnectorOptions) {
    logger.debug(`WhatsAppConnector constructor instanceId=${options.instanceId}`);
    this.allowedPhones = new Set(
      options.allowedPhones.map((phone) => normalizePhoneNumber(phone))
    );
    this.authStore = options.authStore;
    this.instanceId = options.instanceId;
    this.fileStore = options.fileStore;
    this.dataDir = options.dataDir;
    this.printQRInTerminal = options.printQRInTerminal ?? true;
    this.onQRCode = options.onQRCode;
    this.onFatal = options.onFatal;

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

  onPermission(handler: PermissionHandler): () => void {
    this.permissionHandlers.push(handler);
    return () => {
      const index = this.permissionHandlers.indexOf(handler);
      if (index !== -1) {
        this.permissionHandlers.splice(index, 1);
      }
    };
  }

  async sendMessage(targetId: string, message: ConnectorMessage): Promise<void> {
    logger.debug(
      `sendMessage() called targetId=${targetId} hasText=${!!message.text} fileCount=${message.files?.length ?? 0}`
    );

    if (!this.socket) {
      logger.warn("Cannot send message: socket not connected");
      return;
    }

    if (!this.isAllowedTarget(targetId, "sendMessage")) {
      return;
    }

    const jid = phoneToJid(targetId);
    const files = message.files ?? [];

    if (files.length === 0) {
      if (message.text) {
        const formatted = markdownToWhatsAppText(message.text);
        await this.socket.sendMessage(jid, { text: formatted });
      }
      return;
    }

    // Send first file with caption
    const first = files[0];
    if (first) {
      const caption = message.text ? markdownToWhatsAppText(message.text) : undefined;
      await this.sendFile(jid, first, caption);
    }

    // Send remaining files without caption
    for (const file of files.slice(1)) {
      await this.sendFile(jid, file);
    }
  }

  async requestPermission(
    targetId: string,
    request: PermissionRequest,
    context: MessageContext,
    descriptor: AgentDescriptor
  ): Promise<void> {
    if (!this.socket) {
      logger.warn("Cannot request permission: socket not connected");
      return;
    }

    if (!this.isAllowedTarget(targetId, "requestPermission")) {
      return;
    }

    const jid = phoneToJid(targetId);
    this.pendingPermissions.set(request.token, { request, context, descriptor });

    const text = formatPermissionMessage(request, "pending");
    await this.socket.sendMessage(jid, { text });
  }

  startTyping(targetId: string): () => void {
    if (!this.socket || !this.isAllowedTarget(targetId, "startTyping")) {
      return () => undefined;
    }

    const jid = phoneToJid(targetId);
    void this.socket.sendPresenceUpdate("composing", jid);

    return () => {
      if (this.socket) {
        void this.socket.sendPresenceUpdate("paused", jid);
      }
    };
  }

  async setReaction(
    targetId: string,
    messageId: string,
    reaction: string
  ): Promise<void> {
    if (!this.socket || !this.isAllowedTarget(targetId, "setReaction")) {
      return;
    }

    const jid = phoneToJid(targetId);
    await this.socket.sendMessage(jid, {
      react: {
        text: reaction,
        key: {
          remoteJid: jid,
          id: messageId
        }
      }
    });
  }

  async shutdown(reason: string = "shutdown"): Promise<void> {
    logger.debug(`shutdown() called reason=${reason}`);
    if (this.shuttingDown) {
      return;
    }
    this.shuttingDown = true;

    if (this.socket) {
      this.socket.end(undefined);
      this.socket = null;
    }
    logger.debug("WhatsApp connector shutdown complete");
  }

  private async initialize(): Promise<void> {
    logger.debug("initialize() starting");
    await this.connect();
  }

  private async connect(): Promise<void> {
    if (this.shuttingDown) {
      return;
    }

    logger.debug("Connecting to WhatsApp");

    const { state, saveCreds } = await useAuthStoreState(this.authStore, this.instanceId);
    const { version } = await fetchLatestBaileysVersion();

    const socket = makeWASocket({
      version,
      auth: state,
      logger: pino({ level: "silent" }) as never,
      printQRInTerminal: false // QR should already be scanned during onboarding
    });

    this.socket = socket;

    socket.ev.on("creds.update", saveCreds);

    socket.ev.on("connection.update", (update) => {
      this.handleConnectionUpdate(update);
    });

    socket.ev.on("messages.upsert", (event) => {
      void this.handleMessagesUpsert(event);
    });

    logger.debug("WhatsApp socket created, waiting for connection");
  }

  private handleConnectionUpdate(
    update: BaileysEventMap["connection.update"]
  ): void {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      logger.info("WhatsApp QR code received - scan with your phone");
      if (this.printQRInTerminal) {
        qrcodeTerminal.generate(qr, { small: true });
      }
      if (this.onQRCode) {
        this.onQRCode(qr);
      }
    }

    if (connection === "close") {
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      logger.info({ statusCode, shouldReconnect }, "WhatsApp connection closed");

      if (statusCode === DisconnectReason.loggedOut) {
        this.onFatal?.("logged_out", lastDisconnect?.error);
        return;
      }

      if (shouldReconnect && !this.shuttingDown && !this.reconnecting) {
        this.reconnecting = true;
        setTimeout(() => {
          this.reconnecting = false;
          void this.connect();
        }, 3000);
      }
    } else if (connection === "open") {
      logger.info("WhatsApp connected");
    }
  }

  private async handleMessagesUpsert(
    event: BaileysEventMap["messages.upsert"]
  ): Promise<void> {
    const { messages, type } = event;

    if (type !== "notify") {
      return;
    }

    for (const msg of messages) {
      await this.handleMessage(msg);
    }
  }

  private async handleMessage(msg: proto.IWebMessageInfo): Promise<void> {
    const key = msg.key;
    if (!key?.remoteJid || key.fromMe) {
      return;
    }

    const jid = key.remoteJid;
    // Skip group messages
    if (jid.endsWith("@g.us")) {
      logger.debug(`Skipping group message jid=${jid}`);
      return;
    }

    const phone = jidToPhone(jid);
    if (!this.isAllowedPhone(phone)) {
      logger.info({ phone, jid }, "Skipping message from unapproved phone");
      return;
    }

    const text = extractMessageText(msg);
    const messageId = key.id ?? undefined;

    logger.debug(
      `Received WhatsApp message phone=${phone} messageId=${messageId} hasText=${!!text}`
    );

    // Check for permission response
    if (text) {
      const permissionHandled = await this.handlePermissionResponse(text, phone);
      if (permissionHandled) {
        return;
      }
    }

    const descriptor: AgentDescriptor = {
      type: "user",
      connector: "whatsapp",
      userId: phone,
      channelId: phone
    };
    const context: MessageContext = {
      messageId
    };

    // Check for commands
    const trimmedText = text?.trim() ?? "";
    if (trimmedText.startsWith("/")) {
      logger.debug(`Dispatching to command handlers phone=${phone}`);
      for (const handler of this.commandHandlers) {
        await handler(trimmedText, context, descriptor);
      }
      return;
    }

    // Extract files
    const files = await this.extractFiles(msg);

    const payload: ConnectorMessage = {
      text: text ?? null,
      files: files.length > 0 ? files : undefined
    };

    logger.debug(`Dispatching to message handlers phone=${phone}`);
    for (const handler of this.handlers) {
      await handler(payload, context, descriptor);
    }
  }

  private async handlePermissionResponse(
    text: string,
    phone: string
  ): Promise<boolean> {
    const normalized = text.toLowerCase().trim();

    // Look for permission tokens in pending permissions
    for (const [token, pending] of this.pendingPermissions) {
      if (normalized.includes(token.slice(0, 8).toLowerCase())) {
        const approved =
          normalized.includes("allow") ||
          normalized.includes("yes") ||
          normalized.includes("approve");
        const denied =
          normalized.includes("deny") ||
          normalized.includes("no") ||
          normalized.includes("reject");

        if (approved || denied) {
          this.pendingPermissions.delete(token);

          const decision: PermissionDecision = {
            token,
            agentId: pending.request.agentId,
            approved,
            permission: pending.request.permission,
            access: pending.request.access
          };

          // Send confirmation
          if (this.socket) {
            const jid = phoneToJid(phone);
            const status = approved ? "approved" : "denied";
            const confirmText = formatPermissionMessage(pending.request, status);
            await this.socket.sendMessage(jid, { text: confirmText });
          }

          for (const handler of this.permissionHandlers) {
            await handler(decision, pending.context, pending.descriptor);
          }
          return true;
        }
      }
    }
    return false;
  }

  private async sendFile(
    jid: string,
    file: ConnectorFile,
    caption?: string
  ): Promise<void> {
    if (!this.socket) {
      return;
    }

    const fileBuffer = await fs.readFile(file.path);
    const sendAs = file.sendAs ?? "auto";

    if (sendAs === "photo" || (sendAs === "auto" && file.mimeType.startsWith("image/"))) {
      await this.socket.sendMessage(jid, {
        image: fileBuffer,
        caption,
        mimetype: file.mimeType
      });
    } else if (sendAs === "video" || (sendAs === "auto" && file.mimeType.startsWith("video/"))) {
      await this.socket.sendMessage(jid, {
        video: fileBuffer,
        caption,
        mimetype: file.mimeType
      });
    } else {
      await this.socket.sendMessage(jid, {
        document: fileBuffer,
        caption,
        mimetype: file.mimeType,
        fileName: file.name
      });
    }
  }

  private async extractFiles(msg: proto.IWebMessageInfo): Promise<FileReference[]> {
    const files: FileReference[] = [];
    const message = msg.message;

    const key = msg.key;
    if (!message || !this.socket || !key?.id) {
      return files;
    }

    try {
      let mimeType: string | undefined;
      let fileName: string | undefined;

      if (message.imageMessage) {
        mimeType = message.imageMessage.mimetype ?? "image/jpeg";
        fileName = `image-${key.id}.jpg`;
      } else if (message.videoMessage) {
        mimeType = message.videoMessage.mimetype ?? "video/mp4";
        fileName = `video-${key.id}.mp4`;
      } else if (message.documentMessage) {
        mimeType = message.documentMessage.mimetype ?? "application/octet-stream";
        fileName = message.documentMessage.fileName ?? `document-${key.id}`;
      } else if (message.audioMessage) {
        mimeType = message.audioMessage.mimetype ?? "audio/ogg";
        fileName = `audio-${key.id}.ogg`;
      }

      if (mimeType && fileName) {
        // Cast to WAMessage since we've verified key exists
        const buffer = await downloadMediaMessage(
          msg as Parameters<typeof downloadMediaMessage>[0],
          "buffer",
          {},
          {
            logger: pino({ level: "silent" }) as never,
            reuploadRequest: this.socket.updateMediaMessage
          }
        );

        if (Buffer.isBuffer(buffer)) {
          const downloadDir = path.join(this.dataDir, "downloads");
          await fs.mkdir(downloadDir, { recursive: true });
          const tempPath = path.join(downloadDir, fileName);
          await fs.writeFile(tempPath, buffer);

          const stored = await this.fileStore.saveFromPath({
            name: fileName,
            mimeType,
            source: "whatsapp",
            path: tempPath
          });

          await fs.rm(tempPath, { force: true });

          files.push({
            id: stored.id,
            name: stored.name,
            mimeType: stored.mimeType,
            size: stored.size,
            path: stored.path
          });
        }
      }
    } catch (error) {
      logger.warn({ error }, "Failed to download WhatsApp media");
    }

    return files;
  }

  private isAllowedPhone(phone: string): boolean {
    return this.allowedPhones.has(normalizePhoneNumber(phone));
  }

  private isAllowedTarget(targetId: string, action: string): boolean {
    if (this.isAllowedPhone(targetId)) {
      return true;
    }
    logger.warn({ targetId, action }, "Blocked WhatsApp action for unapproved phone");
    return false;
  }
}

/** Normalizes phone number by removing non-digit characters */
function normalizePhoneNumber(phone: string): string {
  return phone.replace(/\D/g, "");
}

/** Converts phone number to WhatsApp JID */
function phoneToJid(phone: string): string {
  const normalized = normalizePhoneNumber(phone);
  return `${normalized}@s.whatsapp.net`;
}

/** Extracts phone number from WhatsApp JID */
function jidToPhone(jid: string): string {
  return jid.replace("@s.whatsapp.net", "").replace("@c.us", "");
}

/** Extracts text content from a WhatsApp message */
function extractMessageText(msg: proto.IWebMessageInfo): string | null {
  const message = msg.message;
  if (!message) {
    return null;
  }

  return (
    message.conversation ??
    message.extendedTextMessage?.text ??
    message.imageMessage?.caption ??
    message.videoMessage?.caption ??
    message.documentMessage?.caption ??
    null
  );
}

type PermissionStatus = "pending" | "approved" | "denied";

function formatPermissionMessage(
  request: PermissionRequest,
  status: PermissionStatus
): string {
  const access = describePermissionKind(request.access);
  const pathStr =
    request.access.kind === "read" || request.access.kind === "write"
      ? request.access.path
      : null;

  const heading =
    status === "approved"
      ? "✅ *Permission granted*"
      : status === "denied"
        ? "❌ *Permission denied*"
        : "🔐 *Permission request*";

  const requesterLine =
    request.requester.kind === "background"
      ? `*Requester*: ${request.requester.label} (background agent)`
      : null;
  const lines = [
    heading,
    "",
    `*Access*: ${access}`,
    pathStr ? `*Path*: \`${pathStr}\`` : null,
    requesterLine,
    `*Reason*: ${request.reason}`,
    "",
    status === "pending"
      ? `Reply with "allow ${request.token.slice(0, 8)}" or "deny ${request.token.slice(0, 8)}"`
      : "Decision recorded."
  ];

  return lines.filter((line): line is string => line !== null).join("\n");
}

function describePermissionKind(access: PermissionRequest["access"]): string {
  if (access.kind === "read") {
    return "Read files";
  }
  if (access.kind === "write") {
    return "Write/edit files";
  }
  if (access.kind === "events") {
    return "Events access";
  }
  return "Network access";
}
