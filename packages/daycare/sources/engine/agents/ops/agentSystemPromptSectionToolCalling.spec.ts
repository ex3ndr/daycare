import type { Tool } from "@mariozechner/pi-ai";
import { describe, expect, it } from "vitest";
import { contextForAgent } from "../context.js";
import type { AgentSystemPromptContext } from "./agentSystemPromptContext.js";
import { agentSystemPromptSectionToolCalling } from "./agentSystemPromptSectionToolCalling.js";

type MockAgentSystem = NonNullable<AgentSystemPromptContext["agentSystem"]>;

function buildMockTools(): Tool[] {
    return [
        { name: "document_read", description: "Read document", parameters: {} },
        { name: "document_write", description: "Write document", parameters: {} },
        { name: "send_agent_message", description: "Send message to agent", parameters: {} },
        { name: "cron_add", description: "Add cron task", parameters: {} },
        { name: "send_user_message", description: "Send message", parameters: {} },
        { name: "say", description: "Send immediate message", parameters: {} },
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
            path: "/user-1/search/ms-1",
            config: {
                kind: "search",
                modelRole: "memorySearch",
                connectorName: null,
                parentAgentId: null,
                foreground: false,
                name: "memory-search",
                description: null,
                systemPrompt: null,
                workspaceDir: null
            }
        });

        const section = await agentSystemPromptSectionToolCalling(context);

        expect(section).toContain("document_read");
        expect(section).toContain("send_agent_message");
        expect(section).not.toContain("cron_add");
        expect(section).not.toContain("send_user_message");
        expect(section).not.toContain("document_write");
    });

    it("filters tools by allowlist for memory-agent", async () => {
        const context = buildContext({
            path: "/user-1/memory/ma-1",
            config: {
                kind: "memory",
                modelRole: "memory",
                connectorName: null,
                parentAgentId: null,
                foreground: false,
                name: "memory-agent",
                description: null,
                systemPrompt: null,
                workspaceDir: null
            }
        });

        const section = await agentSystemPromptSectionToolCalling(context);

        expect(section).toContain("document_read");
        expect(section).toContain("document_write");
        expect(section).not.toContain("cron_add");
        expect(section).not.toContain("send_agent_message");
        expect(section).not.toContain("send_user_message");
    });

    it("shows all tools for regular agents without allowlist", async () => {
        const context = buildContext({
            path: "/user-1/telegram",
            config: {
                kind: "connector",
                modelRole: "user",
                connectorName: "telegram",
                parentAgentId: null,
                foreground: true,
                name: null,
                description: null,
                systemPrompt: null,
                workspaceDir: null
            }
        });

        const section = await agentSystemPromptSectionToolCalling(context);

        expect(section).toContain("document_read");
        expect(section).toContain("send_agent_message");
        expect(section).toContain("cron_add");
        expect(section).toContain("send_user_message");
        expect(section).toContain("prefer the `say` tool");
    });
});
