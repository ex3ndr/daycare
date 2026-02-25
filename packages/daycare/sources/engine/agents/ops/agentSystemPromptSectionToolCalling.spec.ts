import type { Tool } from "@mariozechner/pi-ai";
import { describe, expect, it } from "vitest";
import { contextForAgent } from "../context.js";
import type { AgentSystemPromptContext } from "./agentSystemPromptContext.js";
import { agentSystemPromptSectionToolCalling } from "./agentSystemPromptSectionToolCalling.js";

type MockAgentSystem = NonNullable<AgentSystemPromptContext["agentSystem"]>;

function buildMockTools(): Tool[] {
    return [
        { name: "memory_node_read", description: "Read memory node", parameters: {} },
        { name: "memory_node_write", description: "Write memory node", parameters: {} },
        { name: "cron_add", description: "Add cron task", parameters: {} },
        { name: "send_user_message", description: "Send message", parameters: {} },
        { name: "run_python", description: "Execute Python", parameters: {} }
    ] as Tool[];
}

function buildContext(overrides: Partial<AgentSystemPromptContext> = {}): AgentSystemPromptContext {
    const tools = buildMockTools();
    return {
        ctx: contextForAgent({ userId: "user-1", agentId: "agent-1" }),
        agentSystem: {
            toolResolver: {
                listTools: () => tools,
                listToolsForAgent: () => tools
            }
        } as unknown as MockAgentSystem,
        ...overrides
    };
}

describe("agentSystemPromptSectionToolCalling", () => {
    it("filters tools by allowlist for memory-search agents", async () => {
        const context = buildContext({
            descriptor: { type: "memory-search", id: "ms-1", parentAgentId: "parent-1", name: "search query" }
        });

        const section = await agentSystemPromptSectionToolCalling(context);

        expect(section).toContain("memory_node_read");
        expect(section).not.toContain("cron_add");
        expect(section).not.toContain("send_user_message");
        expect(section).not.toContain("memory_node_write");
    });

    it("filters tools by allowlist for memory-agent", async () => {
        const context = buildContext({
            descriptor: { type: "memory-agent", id: "ma-1" }
        });

        const section = await agentSystemPromptSectionToolCalling(context);

        expect(section).toContain("memory_node_read");
        expect(section).toContain("memory_node_write");
        expect(section).not.toContain("cron_add");
        expect(section).not.toContain("send_user_message");
    });

    it("shows all tools for regular agents without allowlist", async () => {
        const context = buildContext({
            descriptor: { type: "user", connector: "telegram", channelId: "ch-1", userId: "u-1" }
        });

        const section = await agentSystemPromptSectionToolCalling(context);

        expect(section).toContain("memory_node_read");
        expect(section).toContain("cron_add");
        expect(section).toContain("send_user_message");
    });
});
