import { describe, expect, it, vi } from "vitest";

import type { ToolExecutionContext } from "@/types";
import { agentResetToolBuild } from "./agentResetTool.js";

const toolCall = { id: "tool-1", name: "agent_reset" };

describe("agentResetToolBuild", () => {
    it("posts reset for an existing agent", async () => {
        const agentExists = vi.fn(async () => true);
        const post = vi.fn(async () => undefined);
        const tool = agentResetToolBuild();
        const context = contextBuild({ agentExists, post });

        const result = await tool.execute({ agentId: "agent-target" }, context, toolCall);

        expect(agentExists).toHaveBeenCalledWith("agent-target");
        expect(post).toHaveBeenCalledWith({ agentId: "agent-target" }, { type: "reset" });
        expect(result.typedResult.targetAgentId).toBe("agent-target");
    });

    it("passes optional reset message", async () => {
        const agentExists = vi.fn(async () => true);
        const post = vi.fn(async () => undefined);
        const tool = agentResetToolBuild();
        const context = contextBuild({ agentExists, post });

        await tool.execute({ agentId: "agent-target", message: "Manual reset requested." }, context, toolCall);

        expect(post).toHaveBeenCalledWith(
            { agentId: "agent-target" },
            { type: "reset", message: "Manual reset requested." }
        );
    });

    it("throws when target agent does not exist", async () => {
        const agentExists = vi.fn(async () => false);
        const post = vi.fn(async () => undefined);
        const tool = agentResetToolBuild();
        const context = contextBuild({ agentExists, post });

        await expect(tool.execute({ agentId: "missing-agent" }, context, toolCall)).rejects.toThrow(
            "Agent not found: missing-agent"
        );
        expect(post).not.toHaveBeenCalled();
    });

    it("throws when attempting to reset the current agent", async () => {
        const agentExists = vi.fn(async () => true);
        const post = vi.fn(async () => undefined);
        const tool = agentResetToolBuild();
        const context = contextBuild({ agentExists, post });

        await expect(tool.execute({ agentId: "agent-source" }, context, toolCall)).rejects.toThrow(
            "Cannot reset the current agent."
        );
        expect(agentExists).not.toHaveBeenCalled();
        expect(post).not.toHaveBeenCalled();
    });
});

function contextBuild(agentSystem: {
    agentExists: (agentId: string) => Promise<boolean>;
    post: (target: unknown, item: unknown) => Promise<void>;
}): ToolExecutionContext {
    return {
        connectorRegistry: null as unknown as ToolExecutionContext["connectorRegistry"],
        fileStore: null as unknown as ToolExecutionContext["fileStore"],
        auth: null as unknown as ToolExecutionContext["auth"],
        logger: console as unknown as ToolExecutionContext["logger"],
        assistant: null,
        permissions: {
            workingDir: "/tmp",
            writeDirs: ["/tmp"]
        },
        agent: { id: "agent-source" } as unknown as ToolExecutionContext["agent"],
        ctx: null as unknown as ToolExecutionContext["ctx"],
        source: "test",
        messageContext: {},
        agentSystem: agentSystem as unknown as ToolExecutionContext["agentSystem"],
        heartbeats: null as unknown as ToolExecutionContext["heartbeats"]
    };
}
