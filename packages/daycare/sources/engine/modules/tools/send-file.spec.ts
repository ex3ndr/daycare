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
            { connectorKey: "telegram:123" },
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

    it("falls back to the most-recent foreground connector for cron agents", async () => {
        const sendMessage = vi.fn(async () => undefined);
        const tool = buildSendFileTool();
        const ctx = contextBuild({
            connector: {
                capabilities: {
                    sendText: true,
                    sendFiles: { modes: ["document", "photo", "video"] }
                },
                sendMessage
            },
            agent: {
                path: "/123/cron/nightly",
                config: {
                    kind: "cron",
                    modelRole: "system",
                    connectorName: null,
                    parentAgentId: null,
                    foreground: false,
                    name: "nightly",
                    description: null,
                    systemPrompt: null,
                    workspaceDir: null
                }
            },
            source: "cron",
            connectors: {
                telegram: {
                    capabilities: {
                        sendText: true,
                        sendFiles: { modes: ["document", "photo", "video"] }
                    },
                    sendMessage
                }
            },
            foregroundAgentId: "fg-agent",
            foregroundAgentRecord: {
                id: "fg-agent",
                path: "/123/telegram/456",
                connectorName: "telegram",
                connectorKey: "telegram:456"
            },
            connectorKeys: [{ connectorKey: "telegram:456" }]
        });

        await tool.execute({ path: "/tmp/report.csv", mimeType: "text/csv" }, ctx, toolCall);

        expect(sendMessage).toHaveBeenCalledTimes(1);
        expect(sendMessage).toHaveBeenCalledWith(
            { connectorKey: "telegram:456" },
            expect.objectContaining({
                files: [
                    expect.objectContaining({
                        mimeType: "text/csv"
                    })
                ]
            })
        );
    });
});

type TestConnector = {
    capabilities: {
        sendText: boolean;
        sendFiles: {
            modes: Array<"document" | "photo" | "video" | "voice">;
        };
    };
    sendMessage: (recipient: { connectorKey: string }, message: unknown) => Promise<void>;
};

function contextBuild(options: {
    connector: TestConnector;
    connectors?: Record<string, TestConnector>;
    source?: string;
    connectorKeys?: Array<{ connectorKey: string }>;
    foregroundAgentId?: string | null;
    foregroundAgentRecord?: {
        id: string;
        path: string;
        connectorName: string | null;
        connectorKey: string | null;
    } | null;
    agent?: {
        path: string;
        config: {
            kind: "connector" | "agent" | "cron" | "task" | "memory" | "sub" | "search";
            modelRole: "user" | "assistant" | "system";
            connectorName: string | null;
            connectorKey?: string | null;
            parentAgentId: string | null;
            foreground: boolean;
            name: string | null;
            description: string | null;
            systemPrompt: string | null;
            workspaceDir: string | null;
        };
    };
}): ToolExecutionContext {
    const connectors = options.connectors ?? { telegram: options.connector };
    const connectorKeys = options.connectorKeys ?? [{ connectorKey: "telegram:123" }];
    const foregroundAgentId = options.foregroundAgentId ?? null;
    const foregroundAgentRecord = options.foregroundAgentRecord ?? null;
    const agent =
        options.agent ??
        ({
            path: "/123/telegram",
            config: {
                kind: "connector",
                modelRole: "user",
                connectorName: "telegram",
                connectorKey: connectorKeys[0]?.connectorKey ?? null,
                parentAgentId: null,
                foreground: true,
                name: null,
                description: null,
                systemPrompt: null,
                workspaceDir: null
            }
        } as const);

    return {
        connectorRegistry: {
            get: (source: string) => connectors[source]
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
            path: agent.path,
            config: agent.config
        } as unknown as ToolExecutionContext["agent"],
        ctx: contextForAgent({ userId: "123", agentId: "agent-1" }),
        source: options.source ?? "telegram",
        messageContext: {},
        agentSystem: {
            agentFor: () => foregroundAgentId,
            storage: {
                users: {
                    findById: async () => ({ id: "123", connectorKeys })
                },
                agents: {
                    findById: async (id: string) => {
                        if (!foregroundAgentRecord || id !== foregroundAgentRecord.id) {
                            return null;
                        }
                        return foregroundAgentRecord;
                    }
                }
            }
        } as unknown as ToolExecutionContext["agentSystem"]
    };
}
