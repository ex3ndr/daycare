import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../durable/connectorSend.js", () => ({
    connectorSend: vi.fn(async () => undefined)
}));

import type { ToolExecutionContext } from "@/types";
import { connectorSend } from "../../../durable/connectorSend.js";
import { contextForAgent } from "../../agents/context.js";
import { sayTool } from "./sayTool.js";

const connectorSendMock = vi.mocked(connectorSend);

const toolCall = { id: "tool-1", name: "say" };
const recipient = { name: "telegram", key: "channel-1" };

describe("sayTool", () => {
    beforeEach(() => {
        connectorSendMock.mockClear();
    });

    it("sends text to the current foreground target", async () => {
        const sendMessage = vi.fn(async () => undefined);
        const tool = sayTool();
        const context = contextBuild({ sendMessage });

        const result = await tool.execute({ text: "Hello user" }, context, toolCall);

        expect(connectorSendMock).toHaveBeenCalledWith(expect.anything(), recipient.name, recipient, {
            text: "Hello user",
            replyToMessageId: "message-1",
            buttons: undefined,
            files: undefined
        });
        expect(result.toolMessage.isError).toBe(false);
    });

    it("sends URL buttons", async () => {
        const sendMessage = vi.fn(async () => undefined);
        const tool = sayTool();
        const context = contextBuild({ sendMessage });

        await tool.execute(
            {
                text: "Open the app.",
                buttons: [{ type: "url", text: "Open Daycare", url: "https://app.example.com" }]
            },
            context,
            toolCall
        );

        expect(connectorSendMock).toHaveBeenCalledWith(
            expect.anything(),
            recipient.name,
            recipient,
            expect.objectContaining({
                text: "Open the app.",
                buttons: [{ type: "url", text: "Open Daycare", url: "https://app.example.com" }]
            })
        );
    });

    it("sends callback buttons", async () => {
        const sendMessage = vi.fn(async () => undefined);
        const tool = sayTool();
        const context = contextBuild({ sendMessage });

        await tool.execute(
            {
                text: "Pick one.",
                buttons: [{ type: "callback", text: "Retry", callback: "retry_action" }]
            },
            context,
            toolCall
        );

        expect(connectorSendMock).toHaveBeenCalledWith(
            expect.anything(),
            recipient.name,
            recipient,
            expect.objectContaining({
                buttons: [{ type: "callback", text: "Retry", callback: "retry_action" }]
            })
        );
    });

    it("defers sending during pythonExecution and preserves buttons", async () => {
        const sendMessage = vi.fn(async () => undefined);
        const tool = sayTool();
        const context = contextBuild({ sendMessage });
        (context as Record<string, unknown>).pythonExecution = true;

        const result = await tool.execute(
            {
                text: "Hello user",
                buttons: [{ type: "callback", text: "Approve", callback: "approve_request" }]
            },
            context,
            toolCall
        );

        expect(connectorSendMock).not.toHaveBeenCalled();
        expect(result.deferredPayload).toEqual({
            connector: recipient,
            recipient,
            text: "Hello user",
            replyToMessageId: "message-1",
            buttons: [{ type: "callback", text: "Approve", callback: "approve_request" }],
            files: undefined
        });
        expect(result.toolMessage.isError).toBe(false);
    });

    it("sends immediately during pythonExecution when now=true", async () => {
        const sendMessage = vi.fn(async () => undefined);
        const tool = sayTool();
        const context = contextBuild({ sendMessage });
        (context as Record<string, unknown>).pythonExecution = true;

        const result = await tool.execute({ text: "Urgent", now: true }, context, toolCall);

        expect(connectorSendMock).toHaveBeenCalledWith(expect.anything(), recipient.name, recipient, {
            text: "Urgent",
            replyToMessageId: "message-1",
            buttons: undefined,
            files: undefined
        });
        expect(result.deferredPayload).toBeUndefined();
    });

    it("sends a single file attachment", async () => {
        const sendMessage = vi.fn(async () => undefined);
        const sandboxRead = vi.fn(async () => ({
            type: "binary" as const,
            displayPath: "/tmp/photo.png",
            content: Buffer.from("photo")
        }));
        const sandboxWrite = vi.fn(async () => ({
            sandboxPath: "sandbox:/downloads/photo.png",
            resolvedPath: "/tmp/photo.png",
            bytes: 5
        }));
        const tool = sayTool();
        const context = contextBuild({
            sendMessage,
            sandboxRead,
            sandboxWrite,
            sendFilesModes: ["document", "photo", "video", "voice"]
        });

        await tool.execute(
            {
                text: "See attachment.",
                files: [{ path: "/tmp/photo.png", mimeType: "image/png", sendAs: "photo" }]
            },
            context,
            toolCall
        );

        expect(connectorSendMock).toHaveBeenCalledWith(
            expect.anything(),
            recipient.name,
            recipient,
            expect.objectContaining({
                text: "See attachment.",
                files: [
                    {
                        id: "sandbox:/downloads/photo.png",
                        name: "photo.png",
                        mimeType: "image/png",
                        size: 5,
                        path: "/tmp/photo.png",
                        sendAs: "photo"
                    }
                ]
            })
        );
        expect(sandboxRead).toHaveBeenCalledWith({ path: "/tmp/photo.png", binary: true });
    });

    it("sends multiple file attachments", async () => {
        const sendMessage = vi.fn(async () => undefined);
        const sandboxRead = vi.fn(async ({ path }: { path: string }) => ({
            type: "binary" as const,
            displayPath: path,
            content: Buffer.from(path)
        }));
        const sandboxWrite = vi.fn(async ({ path, content }: { path: string; content: Buffer }) => {
            const name = path.replace("~/downloads/", "");
            return {
                sandboxPath: `sandbox:/downloads/${name}`,
                resolvedPath: `/tmp/${name}`,
                bytes: content.length
            };
        });
        const tool = sayTool();
        const context = contextBuild({
            sendMessage,
            sandboxRead,
            sandboxWrite,
            sendFilesModes: ["document", "photo", "video", "voice"]
        });

        await tool.execute(
            {
                text: "Multiple files.",
                files: [
                    { path: "/tmp/photo-1.png", mimeType: "image/png" },
                    { path: "/tmp/report.pdf", mimeType: "application/pdf", sendAs: "document" }
                ]
            },
            context,
            toolCall
        );

        expect(connectorSendMock).toHaveBeenCalledTimes(1);
        const calls = connectorSendMock.mock.calls;
        const message = calls[0]?.[3] as { files?: Array<{ name?: string; mimeType?: string; sendAs?: string }> };
        expect(message?.files).toHaveLength(2);
        expect(message?.files?.[0]).toMatchObject({
            name: "photo-1.png",
            mimeType: "image/png"
        });
        expect(message?.files?.[1]).toMatchObject({
            name: "report.pdf",
            mimeType: "application/pdf",
            sendAs: "document"
        });
    });

    it("sends text, files, and buttons together", async () => {
        const sendMessage = vi.fn(async () => undefined);
        const tool = sayTool();
        const context = contextBuild({
            sendMessage,
            sendFilesModes: ["document", "photo", "video", "voice"]
        });

        await tool.execute(
            {
                text: "Choose and review file.",
                buttons: [{ type: "callback", text: "Confirm", callback: "confirm_send" }],
                files: [{ path: "/tmp/report.txt", mimeType: "text/plain", sendAs: "document" }]
            },
            context,
            toolCall
        );

        expect(connectorSendMock).toHaveBeenCalledTimes(1);
        const calls = connectorSendMock.mock.calls;
        const message = calls[0]?.[3] as { text: string; buttons?: unknown[]; files?: unknown[] };
        expect(message).toBeDefined();
        const payload = message as {
            text: string;
            buttons?: unknown[];
            files?: unknown[];
        };
        expect(payload.text).toBe("Choose and review file.");
        expect(payload.buttons).toEqual([{ type: "callback", text: "Confirm", callback: "confirm_send" }]);
        expect(payload.files).toHaveLength(1);
    });

    it("resolves files before deferring during pythonExecution", async () => {
        const sendMessage = vi.fn(async () => undefined);
        const sandboxRead = vi.fn(async () => ({
            type: "binary" as const,
            displayPath: "/tmp/audio.ogg",
            content: Buffer.from("audio")
        }));
        const sandboxWrite = vi.fn(async () => ({
            sandboxPath: "sandbox:/downloads/audio.ogg",
            resolvedPath: "/tmp/audio.ogg",
            bytes: 5
        }));
        const tool = sayTool();
        const context = contextBuild({
            sendMessage,
            sandboxRead,
            sandboxWrite,
            sendFilesModes: ["document", "photo", "video", "voice"]
        });
        (context as Record<string, unknown>).pythonExecution = true;

        const result = await tool.execute(
            {
                text: "Deferred file.",
                files: [{ path: "/tmp/audio.ogg", mimeType: "audio/ogg", sendAs: "voice" }]
            },
            context,
            toolCall
        );

        expect(connectorSendMock).not.toHaveBeenCalled();
        expect(result.deferredPayload).toMatchObject({
            connector: recipient,
            recipient,
            text: "Deferred file.",
            files: [
                {
                    id: "sandbox:/downloads/audio.ogg",
                    name: "audio.ogg",
                    mimeType: "audio/ogg",
                    size: 5,
                    path: "/tmp/audio.ogg",
                    sendAs: "voice"
                }
            ]
        });
        expect(sandboxRead).toHaveBeenCalledTimes(1);
        expect(sandboxWrite).toHaveBeenCalledTimes(1);
    });

    it("executeDeferred sends via connector with buttons and files", async () => {
        const sendMessage = vi.fn(async () => undefined);
        const tool = sayTool();
        const context = contextBuild({ sendMessage });

        await tool.executeDeferred!(
            {
                connector: recipient,
                recipient,
                text: "deferred msg",
                replyToMessageId: "msg-1",
                buttons: [{ type: "callback", text: "Ack", callback: "ack" }],
                files: [
                    {
                        id: "sandbox:/downloads/report.pdf",
                        name: "report.pdf",
                        mimeType: "application/pdf",
                        size: 42,
                        path: "/tmp/report.pdf",
                        sendAs: "document"
                    }
                ]
            },
            context
        );

        expect(connectorSendMock).toHaveBeenCalledWith(expect.anything(), recipient.name, recipient, {
            text: "deferred msg",
            replyToMessageId: "msg-1",
            buttons: [{ type: "callback", text: "Ack", callback: "ack" }],
            files: [
                {
                    id: "sandbox:/downloads/report.pdf",
                    name: "report.pdf",
                    mimeType: "application/pdf",
                    size: 42,
                    path: "/tmp/report.pdf",
                    sendAs: "document"
                }
            ]
        });
    });

    it("is visible by default only for foreground user agents", () => {
        const tool = sayTool();
        const isUserVisible = tool.visibleByDefault?.({
            ctx: contextForAgent({ userId: "user-1", agentId: "agent-1" }),
            path: "/user-1/telegram",
            config: {
                kind: "connector",
                modelRole: "user",
                connector: recipient,
                parentAgentId: null,
                foreground: true,
                name: null,
                description: null,
                systemPrompt: null,
                workspaceDir: null
            }
        });
        const isSubagentVisible = tool.visibleByDefault?.({
            ctx: contextForAgent({ userId: "user-1", agentId: "agent-2" }),
            path: "/user-1/sub/sub-1",
            config: {
                kind: "sub",
                modelRole: "subagent",
                connector: null,
                parentAgentId: "agent-1",
                foreground: false,
                name: "subagent",
                description: null,
                systemPrompt: null,
                workspaceDir: null
            }
        });

        expect(isUserVisible).toBe(true);
        expect(isSubagentVisible).toBe(false);
    });
});

type TestSendMessage = (recipient: { name: string; key: string }, message: Record<string, unknown>) => Promise<void>;

function contextBuild(options: {
    sendMessage: TestSendMessage;
    sendFilesModes?: Array<"document" | "photo" | "video" | "voice">;
    sandboxRead?: (args: { path: string; binary: true }) => Promise<{
        type: "binary";
        displayPath: string;
        content: Buffer;
    }>;
    sandboxWrite?: (args: { path: string; content: Buffer }) => Promise<{
        sandboxPath: string;
        resolvedPath: string;
        bytes: number;
    }>;
}): ToolExecutionContext {
    const sandboxRead =
        options.sandboxRead ??
        (async ({ path }: { path: string; binary: true }) => ({
            type: "binary" as const,
            displayPath: path,
            content: Buffer.from(path)
        }));
    const sandboxWrite =
        options.sandboxWrite ??
        (async ({ path, content }: { path: string; content: Buffer }) => {
            const name = path.replace("~/downloads/", "");
            return {
                sandboxPath: `sandbox:/downloads/${name}`,
                resolvedPath: `/tmp/${name}`,
                bytes: content.length
            };
        });

    return {
        connectorRegistry: {
            get: () => ({
                capabilities: {
                    sendText: true,
                    ...(options.sendFilesModes ? { sendFiles: { modes: options.sendFilesModes } } : {})
                },
                onMessage: () => () => undefined,
                sendMessage: options.sendMessage
            })
        } as unknown as ToolExecutionContext["connectorRegistry"],
        sandbox: {
            read: sandboxRead,
            write: sandboxWrite
        } as unknown as ToolExecutionContext["sandbox"],
        auth: null as unknown as ToolExecutionContext["auth"],
        logger: console as unknown as ToolExecutionContext["logger"],
        assistant: null,
        agent: {
            id: "agent-1",
            path: "/user-1/telegram",
            config: {
                kind: "connector",
                modelRole: "user",
                connector: recipient,
                parentAgentId: null,
                foreground: true,
                name: null,
                description: null,
                systemPrompt: null,
                workspaceDir: null
            }
        } as unknown as ToolExecutionContext["agent"],
        ctx: contextForAgent({ userId: "user-1", agentId: "agent-1" }),
        source: "telegram",
        messageContext: { messageId: "message-1" },
        agentSystem: {
            storage: {
                users: {
                    findById: async () => ({
                        id: "user-1",
                        connectorKeys: [{ connectorKey: "telegram:channel-1" }]
                    })
                }
            }
        } as unknown as ToolExecutionContext["agentSystem"]
    };
}
