import { describe, expect, it } from "vitest";

import { agentDescriptorLabel } from "./agentDescriptorLabel.js";

describe("agentDescriptorLabel", () => {
    it("labels named agents", () => {
        expect(
            agentDescriptorLabel({
                type: "subagent",
                id: "sub-1",
                parentAgentId: "parent",
                name: "web-checker"
            })
        ).toBe("web-checker");
        expect(
            agentDescriptorLabel({
                type: "permanent",
                id: "perm-1",
                name: "memory",
                username: "memorybot",
                description: "desc",
                systemPrompt: "prompt"
            })
        ).toBe("memory (@memorybot)");
        expect(
            agentDescriptorLabel({
                type: "app",
                id: "app-agent-1",
                parentAgentId: "parent",
                name: "github-reviewer",
                systemPrompt: "prompt",
                appId: "github-reviewer"
            })
        ).toBe("Github Reviewer");
        expect(
            agentDescriptorLabel({
                type: "app",
                id: "app-agent-2",
                parentAgentId: "parent",
                name: "RuTracker Search",
                systemPrompt: "prompt",
                appId: "rutracker-search"
            })
        ).toBe("RuTracker Search");
    });

    it("labels non-user agents", () => {
        expect(
            agentDescriptorLabel({
                type: "cron",
                id: "cron-1"
            })
        ).toBe("cron task");
        expect(
            agentDescriptorLabel({
                type: "cron",
                id: "cron-2",
                name: "daily summary"
            })
        ).toBe("daily summary");
        expect(agentDescriptorLabel({ type: "system", tag: "heartbeat" })).toBe("heartbeat");
        expect(agentDescriptorLabel({ type: "system", tag: "architect" })).toBe("architect");
    });

    it("labels user agents", () => {
        expect(
            agentDescriptorLabel({
                type: "user",
                connector: "telegram",
                userId: "u1",
                channelId: "c1"
            })
        ).toBe("user");
    });
});
