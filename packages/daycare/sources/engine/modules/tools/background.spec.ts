import { describe, expect, it, vi } from "vitest";

import type { ToolExecutionContext } from "@/types";
import { contextForAgent } from "../../agents/context.js";
import { buildSendAgentMessageTool, buildStartBackgroundAgentTool } from "./background.js";

const startToolCall = { id: "tool-1", name: "start_background_agent" };
const sendToolCall = { id: "tool-2", name: "send_agent_message" };

describe("buildStartBackgroundAgentTool", () => {
    it("creates subagent target and posts the first message", async () => {
        const calls: string[] = [];
        const resolveTarget = vi.fn(async () => {
            calls.push("resolve");
            return "agent-123";
        });
        const post = vi.fn(async () => {
            calls.push("post");
        });

        const tool = buildStartBackgroundAgentTool();
        const context = contextBuild({
            agentIdForTarget: resolveTarget,
            post
        });

        const result = await tool.execute({ prompt: "Do work" }, context, startToolCall);

        expect(calls).toEqual(["resolve", "post"]);
        expect(post).toHaveBeenCalledWith(
            context.ctx,
            { agentId: "agent-123" },
            { type: "message", message: { text: "Do work" }, context: {} }
        );
        expect(contentText(result.toolMessage.content)).toContain("agent-123");
    });
});

describe("buildSendAgentMessageTool", () => {
    it("sends direct text when payload fits inline limit", async () => {
        const post = vi.fn(async () => {});
        const context = contextBuild(
            {
                post
            },
            {
                agentId: "child-agent",
                descriptor: {
                    type: "subagent",
                    id: "child-agent",
                    parentAgentId: "parent-agent",
                    name: "child"
                }
            }
        );
        const tool = buildSendAgentMessageTool();

        await tool.execute({ text: "short update" }, context, sendToolCall);

        expect(post).toHaveBeenCalledWith(
            context.ctx,
            { agentId: "parent-agent" },
            { type: "system_message", text: "short update", origin: "child-agent" }
        );
    });

    it("defers sending during pythonExecution", async () => {
        const post = vi.fn(async () => {});
        const context = contextBuild(
            { post },
            {
                agentId: "child-agent",
                descriptor: {
                    type: "subagent",
                    id: "child-agent",
                    parentAgentId: "parent-agent",
                    name: "child"
                }
            }
        );
        (context as Record<string, unknown>).pythonExecution = true;
        const tool = buildSendAgentMessageTool();

        const result = await tool.execute({ text: "short update" }, context, sendToolCall);

        expect(post).not.toHaveBeenCalled();
        expect(result.deferredPayload).toBeDefined();
        expect(result.toolMessage.isError).toBe(false);
    });

    it("sends immediately during pythonExecution when now=true", async () => {
        const post = vi.fn(async () => {});
        const context = contextBuild(
            { post },
            {
                agentId: "child-agent",
                descriptor: {
                    type: "subagent",
                    id: "child-agent",
                    parentAgentId: "parent-agent",
                    name: "child"
                }
            }
        );
        (context as Record<string, unknown>).pythonExecution = true;
        const tool = buildSendAgentMessageTool();

        const result = await tool.execute({ text: "urgent", now: true }, context, sendToolCall);

        expect(post).toHaveBeenCalled();
        expect(result.deferredPayload).toBeUndefined();
    });

    it("always sends steering immediately even during pythonExecution", async () => {
        const steer = vi.fn(async () => {});
        const context = contextBuild(
            { steer, agentExists: vi.fn(async () => true) },
            {
                agentId: "child-agent",
                descriptor: {
                    type: "subagent",
                    id: "child-agent",
                    parentAgentId: "parent-agent",
                    name: "child"
                }
            }
        );
        (context as Record<string, unknown>).pythonExecution = true;
        const tool = buildSendAgentMessageTool();

        const result = await tool.execute({ text: "interrupt!", steering: true }, context, sendToolCall);

        expect(steer).toHaveBeenCalled();
        expect(result.deferredPayload).toBeUndefined();
    });

    it("writes oversized text to output file and sends a reference", async () => {
        let postedItem: unknown = null;
        const post = vi.fn(async (_ctx: unknown, _target: unknown, item: unknown) => {
            postedItem = item;
        });
        const write = vi.fn(async () => ({ bytes: 100, resolvedPath: "/tmp/a", sandboxPath: "~/outputs/a.md" }));
        const context = contextBuild(
            {
                post
            },
            {
                sandboxWrite: write,
                agentId: "child-agent",
                descriptor: {
                    type: "subagent",
                    id: "child-agent",
                    parentAgentId: "parent-agent",
                    name: "child"
                }
            }
        );
        const tool = buildSendAgentMessageTool();

        const result = await tool.execute({ text: "x".repeat(8_001) }, context, sendToolCall);

        expect(write).toHaveBeenCalledTimes(1);
        expect(post).toHaveBeenCalledTimes(1);
        if (!postedItem) {
            throw new Error("Expected posted payload.");
        }
        const payload = postedItem as { type: string; text: string; origin: string };
        expect(payload.type).toBe("system_message");
        expect(payload.origin).toBe("child-agent");
        expect(payload.text).toContain("Message exceeded 8000 characters");
        expect(payload.text).toMatch(/~\/outputs\/\d{14}-agent-message-/);
        expect(payload.text).toContain(".md");
        expect(contentText(result.toolMessage.content)).toContain("Full content saved");
    });

    it("writes oversized steering text to output file and steers with a reference", async () => {
        let steerItem: unknown = null;
        const steer = vi.fn(async (_ctx: unknown, _agentId: string, item: unknown) => {
            steerItem = item;
        });
        const write = vi.fn(async () => ({ bytes: 100, resolvedPath: "/tmp/a", sandboxPath: "~/outputs/a.md" }));
        const context = contextBuild(
            {
                steer,
                agentExists: vi.fn(async () => true)
            },
            {
                sandboxWrite: write,
                agentId: "child-agent",
                descriptor: {
                    type: "subagent",
                    id: "child-agent",
                    parentAgentId: "parent-agent",
                    name: "child"
                }
            }
        );
        const tool = buildSendAgentMessageTool();

        await tool.execute({ text: "y".repeat(8_001), steering: true }, context, sendToolCall);

        expect(write).toHaveBeenCalledTimes(1);
        expect(steer).toHaveBeenCalledTimes(1);
        if (!steerItem) {
            throw new Error("Expected steering payload.");
        }
        const payload = steerItem as { type: string; text: string; origin: string };
        expect(payload.type).toBe("steering");
        expect(payload.origin).toBe("child-agent");
        expect(payload.text).toMatch(/~\/outputs\/\d{14}-agent-message-/);
    });

    it("defaults swarm replies to the latest known contact and uses target user context", async () => {
        const post = vi.fn(async () => {});
        const listContacts = vi.fn(async () => [
            {
                swarmUserId: "swarm-user-1",
                contactAgentId: "contact-agent-2",
                swarmAgentId: "swarm-agent-1",
                messagesSent: 0,
                messagesReceived: 1,
                firstContactAt: 1,
                lastContactAt: 2
            }
        ]);
        const isKnownContact = vi.fn(async () => true);
        const recordSent = vi.fn(async () => {});
        const context = contextBuild(
            {
                post,
                contextForAgentId: vi.fn(async () =>
                    contextForAgent({ userId: "contact-user-2", agentId: "contact-agent-2" })
                ),
                storage: {
                    swarmContacts: { listContacts, isKnownContact, recordSent }
                }
            },
            {
                userId: "swarm-user-1",
                agentId: "swarm-agent-1",
                descriptor: { type: "swarm", id: "swarm-user-1" }
            }
        );
        const tool = buildSendAgentMessageTool();

        await tool.execute({ text: "reply" }, context, sendToolCall);

        expect(listContacts).toHaveBeenCalledWith("swarm-user-1");
        expect(post).toHaveBeenCalledWith(
            expect.objectContaining({ userId: "contact-user-2", hasAgentId: true }),
            { agentId: "contact-agent-2" },
            { type: "system_message", text: "reply", origin: "swarm-agent-1" }
        );
        expect(recordSent).toHaveBeenCalledWith("swarm-user-1", "contact-agent-2");
    });

    it("fails for swarm replies when no known contacts exist", async () => {
        const context = contextBuild(
            {
                agentFor: vi.fn(() => undefined),
                storage: {
                    swarmContacts: {
                        listContacts: vi.fn(async () => []),
                        isKnownContact: vi.fn(async () => false),
                        recordSent: vi.fn(async () => {})
                    }
                }
            },
            {
                userId: "swarm-user-1",
                agentId: "swarm-agent-1",
                descriptor: { type: "swarm", id: "swarm-user-1" }
            }
        );
        const tool = buildSendAgentMessageTool();

        await expect(tool.execute({ text: "reply" }, context, sendToolCall)).rejects.toThrow(
            "No known swarm contacts found."
        );
    });

    it("allows swarm messages to same-user agents without contact checks", async () => {
        const post = vi.fn(async () => {});
        const isKnownContact = vi.fn(async () => false);
        const context = contextBuild(
            {
                post,
                contextForAgentId: vi.fn(async () =>
                    contextForAgent({ userId: "swarm-user-1", agentId: "swarm-subagent-1" })
                ),
                storage: {
                    swarmContacts: {
                        listContacts: vi.fn(async () => []),
                        isKnownContact,
                        recordSent: vi.fn(async () => {})
                    }
                }
            },
            {
                userId: "swarm-user-1",
                agentId: "swarm-agent-1",
                descriptor: { type: "swarm", id: "swarm-user-1" }
            }
        );
        const tool = buildSendAgentMessageTool();

        await tool.execute({ text: "ping child", agentId: "swarm-subagent-1" }, context, sendToolCall);

        expect(post).toHaveBeenCalledWith(
            expect.objectContaining({ userId: "swarm-user-1", hasAgentId: true }),
            { agentId: "swarm-subagent-1" },
            { type: "system_message", text: "ping child", origin: "swarm-agent-1" }
        );
        expect(isKnownContact).not.toHaveBeenCalled();
    });

    it("allows swarms to message same-user agents started in background", async () => {
        const post = vi.fn(async () => {});
        const isKnownContact = vi.fn(async () => false);
        const context = contextBuild(
            {
                post,
                agentIdForTarget: vi.fn(async () => "swarm-subagent-2"),
                contextForAgentId: vi.fn(async (agentId: string) =>
                    contextForAgent({ userId: "swarm-user-1", agentId })
                ),
                storage: {
                    swarmContacts: {
                        listContacts: vi.fn(async () => []),
                        isKnownContact,
                        recordSent: vi.fn(async () => {})
                    }
                }
            },
            {
                userId: "swarm-user-1",
                agentId: "swarm-agent-1",
                descriptor: { type: "swarm", id: "swarm-user-1" }
            }
        );
        const startTool = buildStartBackgroundAgentTool();
        const sendTool = buildSendAgentMessageTool();

        const startResult = await startTool.execute({ prompt: "Do work" }, context, startToolCall);
        await sendTool.execute(
            { text: "follow up", agentId: startResult.typedResult.targetAgentId },
            context,
            sendToolCall
        );

        expect(post).toHaveBeenNthCalledWith(
            1,
            context.ctx,
            { agentId: "swarm-subagent-2" },
            { type: "message", message: { text: "Do work" }, context: {} }
        );
        expect(post).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({ userId: "swarm-user-1", hasAgentId: true }),
            { agentId: "swarm-subagent-2" },
            { type: "system_message", text: "follow up", origin: "swarm-agent-1" }
        );
        expect(isKnownContact).not.toHaveBeenCalled();
    });
});

type AgentSystemStub = Partial<{
    agentIdForTarget: (ctx: unknown, target: unknown) => Promise<string>;
    post: (ctx: unknown, target: unknown, item: unknown) => Promise<void>;
    agentFor: (ctx: unknown, target: unknown) => string | undefined;
    agentExists: (agentId: string) => Promise<boolean>;
    steer: (ctx: unknown, agentId: string, item: unknown) => Promise<void>;
    contextForAgentId: (agentId: string) => Promise<unknown>;
    storage: {
        swarmContacts: {
            listContacts: (swarmUserId: string) => Promise<Array<{ contactAgentId: string }>>;
            isKnownContact: (swarmUserId: string, contactAgentId: string) => Promise<boolean>;
            recordSent: (swarmUserId: string, contactAgentId: string) => Promise<void>;
        };
    };
}>;

type ContextBuildOptions = {
    sandboxWrite?: (args: { path: string; content: string | Buffer }) => Promise<{
        bytes: number;
        resolvedPath: string;
        sandboxPath: string;
    }>;
    agentId?: string;
    descriptor?: unknown;
    userId?: string;
};

function contextBuild(agentSystem: AgentSystemStub, options: ContextBuildOptions = {}): ToolExecutionContext {
    const agentId = options.agentId ?? "parent-agent";
    const userId = options.userId ?? "user-1";
    const descriptor =
        options.descriptor ??
        ({
            type: "subagent",
            id: agentId,
            parentAgentId: "parent-agent",
            name: "agent"
        } as const);
    const sandboxWrite =
        options.sandboxWrite ??
        (vi.fn(async () => ({
            bytes: 0,
            resolvedPath: "/tmp/unused.md",
            sandboxPath: "~/outputs/unused.md"
        })) as ContextBuildOptions["sandboxWrite"]);
    return {
        connectorRegistry: null as unknown as ToolExecutionContext["connectorRegistry"],
        sandbox: {
            write: sandboxWrite,
            homeDir: "/tmp/home"
        } as unknown as ToolExecutionContext["sandbox"],
        auth: null as unknown as ToolExecutionContext["auth"],
        logger: console as unknown as ToolExecutionContext["logger"],
        assistant: null,
        agent: { id: agentId, descriptor, userId } as unknown as ToolExecutionContext["agent"],
        ctx: contextForAgent({ userId, agentId }),
        source: "test",
        messageContext: {},
        agentSystem: {
            agentIdForTarget:
                agentSystem.agentIdForTarget ?? (vi.fn(async () => "agent-123") as AgentSystemStub["agentIdForTarget"]),
            post: agentSystem.post ?? (vi.fn(async () => {}) as AgentSystemStub["post"]),
            agentFor: agentSystem.agentFor ?? (vi.fn(() => "foreground-agent") as AgentSystemStub["agentFor"]),
            agentExists: agentSystem.agentExists ?? (vi.fn(async () => true) as AgentSystemStub["agentExists"]),
            steer: agentSystem.steer ?? (vi.fn(async () => {}) as AgentSystemStub["steer"]),
            contextForAgentId:
                agentSystem.contextForAgentId ??
                (vi.fn(async (_agentId: string) =>
                    contextForAgent({ userId, agentId })
                ) as AgentSystemStub["contextForAgentId"]),
            storage:
                agentSystem.storage ??
                ({
                    swarmContacts: {
                        listContacts: vi.fn(async () => []),
                        isKnownContact: vi.fn(async () => false),
                        recordSent: vi.fn(async () => {})
                    }
                } as AgentSystemStub["storage"])
        } as unknown as ToolExecutionContext["agentSystem"]
    };
}

function contentText(content: unknown): string {
    if (!Array.isArray(content)) {
        return "";
    }
    return content
        .filter((item) => {
            if (typeof item !== "object" || item === null) {
                return false;
            }
            return (item as { type?: unknown }).type === "text";
        })
        .map((item) => (item as { text?: unknown }).text)
        .filter((value): value is string => typeof value === "string")
        .join("\n");
}
