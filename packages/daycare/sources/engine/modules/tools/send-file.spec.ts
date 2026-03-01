import { describe, expect, it, vi } from "vitest";
import type { ToolExecutionContext } from "@/types";
import { contextForAgent } from "../../agents/context.js";
import { buildSendFileTool } from "./send-file.js";

const toolCall = { id: "tool-1", name: "send_file" };

describe("buildSendFileTool", () => {
    it("forwards voice send mode when connector supports it", async () => {
        const sendMessage = vi.fn(async () => undefined);
        const tool = buildSendFileTool();
        const ctx = contextBuild({
            connector: {
                capabilities: {
                    sendText: true,
                    sendFiles: {
                        modes: ["document", "photo", "video", "voice"]
                    }
                },
                sendMessage
            }
        });

        await tool.execute(
            {
                path: "/tmp/voice-note.ogg",
                mimeType: "audio/ogg",
                sendAs: "voice"
            },
            ctx,
            toolCall
        );

        expect(sendMessage).toHaveBeenCalledTimes(1);
        expect(sendMessage).toHaveBeenCalledWith(
            "123",
            expect.objectContaining({
                files: [
                    expect.objectContaining({
                        sendAs: "voice",
                        mimeType: "audio/ogg"
                    })
                ]
            })
        );
    });

    it("defers sending during pythonExecution", async () => {
        const sendMessage = vi.fn(async () => undefined);
        const tool = buildSendFileTool();
        const ctx = contextBuild({
            connector: {
                capabilities: {
                    sendText: true,
                    sendFiles: { modes: ["document", "photo", "video"] }
                },
                sendMessage
            }
        });
        (ctx as Record<string, unknown>).pythonExecution = true;

        const result = await tool.execute({ path: "/tmp/voice-note.ogg", mimeType: "audio/ogg" }, ctx, toolCall);

        expect(sendMessage).not.toHaveBeenCalled();
        expect(result.deferredPayload).toBeDefined();
        expect(result.toolMessage.isError).toBe(false);
    });

    it("sends immediately during pythonExecution when now=true", async () => {
        const sendMessage = vi.fn(async () => undefined);
        const tool = buildSendFileTool();
        const ctx = contextBuild({
            connector: {
                capabilities: {
                    sendText: true,
                    sendFiles: { modes: ["document", "photo", "video"] }
                },
                sendMessage
            }
        });
        (ctx as Record<string, unknown>).pythonExecution = true;

        const result = await tool.execute(
            { path: "/tmp/voice-note.ogg", mimeType: "audio/ogg", now: true },
            ctx,
            toolCall
        );

        expect(sendMessage).toHaveBeenCalled();
        expect(result.deferredPayload).toBeUndefined();
    });

    it("rejects voice send mode when connector does not support it", async () => {
        const sendMessage = vi.fn(async () => undefined);
        const tool = buildSendFileTool();
        const ctx = contextBuild({
            connector: {
                capabilities: {
                    sendText: true,
                    sendFiles: {
                        modes: ["document", "photo", "video"]
                    }
                },
                sendMessage
            }
        });

        await expect(
            tool.execute(
                {
                    path: "/tmp/voice-note.ogg",
                    mimeType: "audio/ogg",
                    sendAs: "voice"
                },
                ctx,
                toolCall
            )
        ).rejects.toThrow("Connector does not support voice mode");
        expect(sendMessage).not.toHaveBeenCalled();
    });
});

function contextBuild(options: {
    connector: {
        capabilities: {
            sendText: boolean;
            sendFiles: {
                modes: Array<"document" | "photo" | "video" | "voice">;
            };
        };
        sendMessage: (targetId: string, message: unknown) => Promise<void>;
    };
}): ToolExecutionContext {
    return {
        connectorRegistry: {
            get: () => options.connector
        } as unknown as ToolExecutionContext["connectorRegistry"],
        sandbox: {
            read: async () =>
                ({
                    type: "binary",
                    displayPath: "/tmp/voice-note.ogg",
                    content: Buffer.from("voice")
                }) as const,
            write: async () =>
                ({
                    sandboxPath: "sandbox:/downloads/voice-note.ogg",
                    resolvedPath: "/tmp/voice-note.ogg",
                    bytes: 5
                }) as const
        } as unknown as ToolExecutionContext["sandbox"],
        auth: null as unknown as ToolExecutionContext["auth"],
        logger: console as unknown as ToolExecutionContext["logger"],
        assistant: null,
        agent: {
            id: "agent-1",
            descriptor: { type: "user", connector: "telegram", userId: "123", channelId: "123" }
        } as unknown as ToolExecutionContext["agent"],
        ctx: contextForAgent({ userId: "123", agentId: "agent-1" }),
        source: "telegram",
        messageContext: {},
        agentSystem: null as unknown as ToolExecutionContext["agentSystem"]
    };
}
