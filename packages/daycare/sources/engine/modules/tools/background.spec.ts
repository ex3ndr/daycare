import { describe, expect, it, vi } from "vitest";

import type { ToolExecutionContext } from "@/types";
import { contextForAgent } from "../../agents/context.js";
import { buildSendAgentMessageTool, buildStartBackgroundAgentTool } from "./background.js";
import { startBackgroundWorkflowToolBuild } from "./startBackgroundWorkflowTool.js";

const startToolCall = { id: "tool-1", name: "start_background_agent" };
const sendToolCall = { id: "tool-2", name: "send_agent_message" };
const workflowToolCall = { id: "tool-3", name: "start_background_workflow" };

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
});

describe("startBackgroundWorkflowToolBuild", () => {
    it("starts a child workflow from inline code", async () => {
        let postedItem: unknown = null;
        const post = vi.fn(async (_ctx: unknown, _target: unknown, item: unknown) => {
            postedItem = item;
        });
        const tool = startBackgroundWorkflowToolBuild();
        const context = contextBuild({
            post
        });

        const result = await tool.execute(
            {
                code: "print('collect status')",
                parameters: { limit: 3 },
                inputSchema: [{ name: "limit", type: "integer", nullable: false }]
            },
            context,
            workflowToolCall
        );

        expect(post).toHaveBeenCalledWith(
            context.ctx,
            { agentId: "agent-123" },
            expect.objectContaining({
                type: "system_message",
                text: "[workflow]\nmode: code",
                origin: "workflow",
                code: "print('collect status')",
                inputs: { limit: 3 },
                inputSchemas: [{ name: "limit", type: "integer", nullable: false }],
                context: context.messageContext
            })
        );
        expect(postedItem).toBeTruthy();
        expect(result.typedResult.targetAgentId).toBe("agent-123");
    });

    it("starts a child workflow from a stored task", async () => {
        const dispatch = vi.fn();
        const tool = startBackgroundWorkflowToolBuild();
        const context = contextBuild({
            taskExecutions: { dispatch },
            storage: {
                agents: {
                    findByPath: vi.fn(async () => ({ id: "agent-123" }))
                },
                tasks: {
                    findById: vi.fn(async () => ({
                        id: "task-42",
                        userId: "user-1",
                        version: 7,
                        title: "Nightly review",
                        parameters: [{ name: "dryRun", type: "boolean", nullable: false }]
                    })),
                    findByVersion: vi.fn(async () => null)
                }
            }
        });

        const result = await tool.execute(
            {
                taskId: "task-42",
                parameters: { dryRun: true }
            },
            context,
            workflowToolCall
        );

        expect(dispatch).toHaveBeenCalledWith({
            userId: "user-1",
            source: "manual",
            taskId: "task-42",
            taskVersion: 7,
            origin: "workflow",
            target: { agentId: "agent-123" },
            text: "[workflow]\ntaskId: task-42\ntaskTitle: Nightly review",
            parameters: { dryRun: true },
            context: context.messageContext
        });
        expect(result.typedResult.taskId).toBe("task-42");
    });
});

type AgentSystemStub = Partial<{
    agentIdForTarget: (ctx: unknown, target: unknown) => Promise<string>;
    post: (ctx: unknown, target: unknown, item: unknown) => Promise<void>;
    agentFor: (ctx: unknown, target: unknown) => string | undefined;
    agentExists: (agentId: string) => Promise<boolean>;
    steer: (ctx: unknown, agentId: string, item: unknown) => Promise<void>;
    contextForAgentId: (agentId: string) => Promise<unknown>;
    taskExecutions: {
        dispatch: (input: unknown) => void;
    };
    toolResolver: {
        listTools: () => Array<{ name: string }>;
        listToolsForAgent: () => Array<{ name: string }>;
        execute: (name: string, args: unknown, context: unknown, toolCallId?: string) => Promise<unknown>;
        deferredHandlerFor: (toolName: string) => unknown;
    };
    storage: {
        agents?: {
            findByPath: (path: string) => Promise<{ id: string } | null>;
            findById?: (id: string) => Promise<{ id: string; path: string; nextSubIndex?: number } | null>;
            update?: (id: string, patch: { nextSubIndex: number; updatedAt: number }) => Promise<void>;
        };
        tasks?: {
            findById: (
                ctx: unknown,
                taskId: string
            ) => Promise<{
                id: string;
                userId: string;
                version?: number;
                title: string;
                parameters: Array<{ name: string; type: string; nullable: boolean }> | null;
            } | null>;
            findByVersion: (
                ctx: unknown,
                taskId: string,
                version: number
            ) => Promise<{
                id: string;
                userId: string;
                version?: number;
                title: string;
                parameters: Array<{ name: string; type: string; nullable: boolean }> | null;
            } | null>;
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
    const agentPath = agentPathFromDescriptorFixture(descriptor, userId, agentId);
    const agentConfig = agentConfigFromDescriptorFixture(descriptor);
    const defaultToolResolver = {
        listTools: () => [],
        listToolsForAgent: () => [],
        execute: vi.fn(async () => {
            throw new Error("not used");
        }),
        deferredHandlerFor: vi.fn(() => undefined)
    } as unknown as NonNullable<ToolExecutionContext["toolResolver"]>;
    const toolResolver = (agentSystem.toolResolver ?? defaultToolResolver) as ToolExecutionContext["toolResolver"];
    return {
        connectorRegistry: null as unknown as ToolExecutionContext["connectorRegistry"],
        sandbox: {
            write: sandboxWrite,
            homeDir: "/tmp/home"
        } as unknown as ToolExecutionContext["sandbox"],
        auth: null as unknown as ToolExecutionContext["auth"],
        logger: console as unknown as ToolExecutionContext["logger"],
        assistant: null,
        agent: {
            id: agentId,
            path: agentPath,
            config: agentConfig,
            userId
        } as unknown as ToolExecutionContext["agent"],
        ctx: contextForAgent({ userId, agentId }),
        source: "test",
        messageContext: {},
        toolResolver,
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
            taskExecutions:
                agentSystem.taskExecutions ??
                ({
                    dispatch: vi.fn()
                } as AgentSystemStub["taskExecutions"]),
            storage:
                agentSystem.storage ??
                ({
                    agents: {
                        findById: vi.fn(async (id: string) => ({
                            id,
                            path: agentPath,
                            nextSubIndex: 0
                        })),
                        findByPath: vi.fn(async (pathValue: string) => {
                            const parts = String(pathValue)
                                .split("/")
                                .filter((segment) => segment.length > 0);
                            const id = parts.at(-1) ?? null;
                            return id ? { id } : null;
                        }),
                        update: vi.fn(async () => {})
                    },
                    tasks: {
                        findById: vi.fn(async () => null),
                        findByVersion: vi.fn(async () => null)
                    }
                } as AgentSystemStub["storage"])
        } as unknown as ToolExecutionContext["agentSystem"]
    };
}

function agentPathFromDescriptorFixture(descriptor: unknown, userId: string, agentId: string): string {
    if (typeof descriptor !== "object" || !descriptor) {
        return `/${userId}/sub/${agentId}`;
    }
    const value = descriptor as Record<string, unknown>;
    const type = typeof value.type === "string" ? value.type : "";
    if (type === "user") {
        const connector = typeof value.connector === "string" ? value.connector : "telegram";
        return `/${userId}/${connector}`;
    }
    if (type === "permanent") {
        const name = typeof value.name === "string" ? value.name : agentId;
        return `/${userId}/agent/${name}`;
    }
    if (type === "subagent") {
        const id = typeof value.id === "string" ? value.id : agentId;
        const parentAgentId = typeof value.parentAgentId === "string" ? value.parentAgentId : "parent-agent";
        return `/${userId}/agent/${parentAgentId}/sub/${id}`;
    }
    return `/${userId}/sub/${agentId}`;
}

function agentConfigFromDescriptorFixture(descriptor: unknown): {
    kind?: string;
    modelRole?: string | null;
    connectorName?: string | null;
    parentAgentId?: string | null;
    foreground: boolean;
    name: string | null;
    description: string | null;
    systemPrompt: string | null;
    workspaceDir: string | null;
} {
    if (typeof descriptor !== "object" || !descriptor) {
        return {
            kind: "agent",
            modelRole: "user",
            connectorName: null,
            parentAgentId: null,
            foreground: false,
            name: null,
            description: null,
            systemPrompt: null,
            workspaceDir: null
        };
    }
    const value = descriptor as Record<string, unknown>;
    const type = typeof value.type === "string" ? value.type : "";
    const connector = typeof value.connector === "string" ? value.connector : null;
    const parentAgentId = typeof value.parentAgentId === "string" ? value.parentAgentId : null;
    const name = typeof value.name === "string" ? value.name : null;
    const kind = type === "subagent" ? "sub" : type === "user" ? "connector" : "agent";
    const modelRole = kind === "sub" ? "subagent" : "user";
    return {
        kind,
        modelRole,
        connectorName: kind === "connector" ? connector : null,
        parentAgentId,
        foreground: type === "user",
        name,
        description: null,
        systemPrompt: null,
        workspaceDir: null
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
