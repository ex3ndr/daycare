import { describe, expect, it } from "vitest";

import { agentDescriptorCacheKey } from "./agentDescriptorCacheKey.js";

describe("agentDescriptorCacheKey", () => {
    it("returns stable keys for user, cron, and system descriptors", () => {
        expect(
            agentDescriptorCacheKey({
                type: "user",
                connector: "telegram",
                userId: "u-1",
                channelId: "c-1"
            })
        ).toBe("/connectors/telegram/u-1/c-1");
        expect(agentDescriptorCacheKey({ type: "cron", id: "cron-1" })).toBe("/cron/cron-1");
        expect(agentDescriptorCacheKey({ type: "system", tag: "scheduler" })).toBe("/system/scheduler");
    });

    it("returns stable key for memory-agent descriptor", () => {
        expect(agentDescriptorCacheKey({ type: "memory-agent", id: "agent-123" })).toBe("/memory-agent/agent-123");
    });

    it("returns stable key for memory-search descriptor", () => {
        expect(
            agentDescriptorCacheKey({
                type: "memory-search",
                id: "ms-1",
                parentAgentId: "parent-1",
                name: "find user preferences"
            })
        ).toBe("/memory-search/ms-1");
    });

    it("returns stable key for subuser descriptor", () => {
        expect(
            agentDescriptorCacheKey({
                type: "subuser",
                id: "sub-user-1",
                name: "my-app",
                systemPrompt: "prompt"
            })
        ).toBe("/subuser/sub-user-1");
    });

    it("returns stable keys for subagent, app, and permanent descriptors", () => {
        expect(
            agentDescriptorCacheKey({
                type: "subagent",
                id: "a-1",
                parentAgentId: "system",
                name: "sub"
            })
        ).toBe("/subagent/a-1");
        expect(
            agentDescriptorCacheKey({
                type: "app",
                id: "a-2",
                parentAgentId: "system",
                name: "reviewer",
                systemPrompt: "prompt",
                appId: "github-reviewer"
            })
        ).toBe("/app/a-2");
        expect(
            agentDescriptorCacheKey({
                type: "permanent",
                id: "a-3",
                name: "ops",
                description: "desc",
                systemPrompt: "prompt"
            })
        ).toBe("/permanent/a-3");
    });
});
