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

    it("resolves registered system prompt metadata", async () => {
        const resolved = await agentPromptResolve({
            type: "system",
            tag: "heartbeat"
        });

        expect(resolved.agentPrompt.length).toBeGreaterThan(0);
        expect(resolved.replaceSystemPrompt).toBe(false);
    });

    it("throws when system tag is unknown", async () => {
        await expect(
            agentPromptResolve({
                type: "system",
                tag: "unknown"
            })
        ).rejects.toThrow("Unknown system agent tag: unknown");
    });
});
