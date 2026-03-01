import { describe, expect, it } from "vitest";

import { agentPromptResolve } from "./agentPromptResolve.js";

describe("agentPromptResolve", () => {
    it("resolves permanent agent prompt without replacement", async () => {
        const resolved = await agentPromptResolve({
            type: "permanent",
            id: "memory",
            name: "memory",
            description: "memory assistant",
            systemPrompt: "  Keep notes organized.  "
        });

        expect(resolved).toEqual({
            agentPrompt: "Keep notes organized.",
            replaceSystemPrompt: false
        });
    });

    it("resolves subuser agent prompt without replacement", async () => {
        const resolved = await agentPromptResolve({
            type: "subuser",
            id: "su-1",
            name: "my-isolated-app",
            systemPrompt: "  You are a helpful assistant.  "
        });

        expect(resolved).toEqual({
            agentPrompt: "You are a helpful assistant.",
            replaceSystemPrompt: false
        });
    });

    it("resolves app agent prompt without replacement", async () => {
        const resolved = await agentPromptResolve({
            type: "app",
            id: "app-1",
            parentAgentId: "parent",
            name: "github-reviewer",
            systemPrompt: "  Review pull requests.  ",
            appId: "github-reviewer"
        });

        expect(resolved).toEqual({
            agentPrompt: "Review pull requests.",
            replaceSystemPrompt: false
        });
    });

    it("resolves memory-agent prompt with full replacement", async () => {
        const resolved = await agentPromptResolve({
            type: "memory-agent",
            id: "agent-1"
        });

        expect(resolved.agentPrompt.length).toBeGreaterThan(0);
        expect(resolved.replaceSystemPrompt).toBe(true);
    });

    it("resolves memory-search prompt with full replacement", async () => {
        const resolved = await agentPromptResolve({
            type: "memory-search",
            id: "ms-1",
            parentAgentId: "parent-1",
            name: "find user preferences"
        });

        expect(resolved.agentPrompt.length).toBeGreaterThan(0);
        expect(resolved.replaceSystemPrompt).toBe(true);
    });

    it("returns empty prompt for non-system descriptors", async () => {
        const resolved = await agentPromptResolve({
            type: "user",
            connector: "telegram",
            userId: "u1",
            channelId: "c1"
        });

        expect(resolved).toEqual({
            agentPrompt: "",
            replaceSystemPrompt: false
        });
    });

    it("returns empty prompt for system tags without bundled prompts", async () => {
        const resolved = await agentPromptResolve({
            type: "system",
            tag: "status"
        });

        expect(resolved).toEqual({
            agentPrompt: "",
            replaceSystemPrompt: false
        });
    });
});
