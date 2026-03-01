import { describe, expect, it } from "vitest";

import { agentPromptResolve } from "./agentPromptResolve.js";

describe("agentPromptResolve", () => {
    it("resolves permanent agent prompt without replacement", async () => {
        const resolved = await agentPromptResolve("/u1/agent/memory", {
            kind: "agent",
            modelRole: "user",
            connectorName: null,
            parentAgentId: null,
            foreground: false,
            name: "memory",
            description: "memory assistant",
            systemPrompt: "  Keep notes organized.  ",
            workspaceDir: null
        });

        expect(resolved).toEqual({
            agentPrompt: "Keep notes organized.",
            replaceSystemPrompt: false
        });
    });

    it("resolves memory-agent prompt with full replacement", async () => {
        const resolved = await agentPromptResolve("/u1/memory/agent-1", {
            kind: "memory",
            modelRole: "memory",
            connectorName: null,
            parentAgentId: null,
            foreground: false,
            name: "memory-agent",
            description: null,
            systemPrompt: null,
            workspaceDir: null
        });

        expect(resolved.agentPrompt.length).toBeGreaterThan(0);
        expect(resolved.replaceSystemPrompt).toBe(true);
    });

    it("resolves memory-search prompt with full replacement", async () => {
        const resolved = await agentPromptResolve("/u1/search/ms-1", {
            kind: "search",
            modelRole: "memorySearch",
            connectorName: null,
            parentAgentId: null,
            foreground: false,
            name: "memory-search",
            description: null,
            systemPrompt: null,
            workspaceDir: null
        });

        expect(resolved.agentPrompt.length).toBeGreaterThan(0);
        expect(resolved.replaceSystemPrompt).toBe(true);
    });

    it("returns empty prompt for non-system paths", async () => {
        const resolved = await agentPromptResolve("/u1/telegram", {
            kind: "connector",
            modelRole: "user",
            connectorName: "telegram",
            parentAgentId: null,
            foreground: true,
            name: null,
            description: null,
            systemPrompt: null,
            workspaceDir: null
        });

        expect(resolved).toEqual({
            agentPrompt: "",
            replaceSystemPrompt: false
        });
    });

    it("returns empty prompt for non-agent kinds without bundled prompt overrides", async () => {
        const resolved = await agentPromptResolve("/u1/task/status", {
            kind: "task",
            modelRole: "task",
            connectorName: null,
            parentAgentId: null,
            foreground: false,
            name: "status",
            description: null,
            systemPrompt: null,
            workspaceDir: null
        });

        expect(resolved).toEqual({
            agentPrompt: "",
            replaceSystemPrompt: false
        });
    });
});
