import { describe, expect, it } from "vitest";
import { contextForAgent } from "../../agents/context.js";
import { agentModelSetToolBuild } from "./agentModelSetToolBuild.js";

describe("agentModelSetToolBuild", () => {
    const tool = agentModelSetToolBuild();
    const baseConfig = {
        current: {
            settings: {}
        }
    };

    it("has the correct tool name", () => {
        expect(tool.tool.name).toBe("set_agent_model");
    });

    it("is visible only to user (foreground) agents", () => {
        expect(
            tool.visibleByDefault?.({
                ctx: contextForAgent({ userId: "user-1", agentId: "agent-1" }),
                path: "/user-1/telegram",
                config: {
                    foreground: true,
                    name: null,
                    description: null,
                    systemPrompt: null,
                    workspaceDir: null
                }
            })
        ).toBe(true);
    });

    it("is not visible to subagent descriptors", () => {
        expect(
            tool.visibleByDefault?.({
                ctx: contextForAgent({ userId: "user-1", agentId: "agent-1" }),
                path: "/user-1/sub/sub-1",
                config: {
                    foreground: false,
                    name: "sub",
                    description: null,
                    systemPrompt: null,
                    workspaceDir: null
                }
            })
        ).toBe(false);
    });

    it("is not visible to permanent agent descriptors", () => {
        expect(
            tool.visibleByDefault?.({
                ctx: contextForAgent({ userId: "user-1", agentId: "agent-1" }),
                path: "/user-1/agent/bot",
                config: {
                    foreground: false,
                    name: "bot",
                    description: "test",
                    systemPrompt: "you are a bot",
                    workspaceDir: null
                }
            })
        ).toBe(false);
    });

    it("is not visible to cron descriptors", () => {
        expect(
            tool.visibleByDefault?.({
                ctx: contextForAgent({ userId: "user-1", agentId: "agent-1" }),
                path: "/user-1/cron/cron-1",
                config: {
                    foreground: false,
                    name: null,
                    description: null,
                    systemPrompt: null,
                    workspaceDir: null
                }
            })
        ).toBe(false);
    });

    it("updates model override for agents in caller user scope", async () => {
        const result = await tool.execute(
            { agentId: "agent-2", model: "small" },
            {
                ctx: contextForAgent({ userId: "user-1", agentId: "agent-1" }),
                agentSystem: {
                    config: baseConfig,
                    contextForAgentId: async () => contextForAgent({ userId: "user-1", agentId: "agent-2" }),
                    updateAgentModelOverride: async () => true
                },
                agent: { descriptor: { type: "user" } },
                messageContext: {}
            } as never,
            { id: "tool-1", name: "set_agent_model" }
        );

        expect(result.toolMessage.isError).toBe(false);
    });

    it("rejects invalid flavors", async () => {
        await expect(
            tool.execute(
                { agentId: "agent-2", model: "custom-model" },
                {
                    ctx: contextForAgent({ userId: "user-1", agentId: "agent-1" }),
                    agentSystem: {
                        config: baseConfig,
                        contextForAgentId: async () => contextForAgent({ userId: "user-1", agentId: "agent-2" }),
                        updateAgentModelOverride: async () => true
                    },
                    agent: { descriptor: { type: "user" } },
                    messageContext: {}
                } as never,
                { id: "tool-1b", name: "set_agent_model" }
            )
        ).rejects.toThrow(
            'Model flavor must be one of built-ins ("small", "normal", "large") or a configured custom flavor.'
        );
    });

    it("rejects model override across users", async () => {
        await expect(
            tool.execute(
                { agentId: "agent-2", model: "small" },
                {
                    ctx: contextForAgent({ userId: "user-1", agentId: "agent-1" }),
                    agentSystem: {
                        config: baseConfig,
                        contextForAgentId: async () => contextForAgent({ userId: "user-2", agentId: "agent-2" }),
                        updateAgentModelOverride: async () => true
                    },
                    agent: { descriptor: { type: "user" } },
                    messageContext: {}
                } as never,
                { id: "tool-2", name: "set_agent_model" }
            )
        ).rejects.toThrow("Cannot change model for agent from another user: agent-2");
    });

    it("accepts configured custom flavors", async () => {
        const result = await tool.execute(
            { agentId: "agent-2", model: "coding" },
            {
                ctx: contextForAgent({ userId: "user-1", agentId: "agent-1" }),
                agentSystem: {
                    config: {
                        current: {
                            settings: {
                                modelFlavors: {
                                    coding: {
                                        model: "openai/codex-mini",
                                        description: "Optimized for code generation"
                                    }
                                }
                            }
                        }
                    },
                    contextForAgentId: async () => contextForAgent({ userId: "user-1", agentId: "agent-2" }),
                    updateAgentModelOverride: async () => true
                },
                agent: { descriptor: { type: "user" } },
                messageContext: {}
            } as never,
            { id: "tool-3", name: "set_agent_model" }
        );

        expect(result.toolMessage.isError).toBe(false);
    });
});
