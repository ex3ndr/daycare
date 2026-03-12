import { describe, expect, it } from "vitest";
import { contextForUser } from "../../../engine/agents/context.js";
import { agentsList } from "./agentsList.js";

describe("agentsList", () => {
    it("returns agent entries", async () => {
        const ctx = contextForUser({ userId: "u1" });

        const result = await agentsList({
            ctx,
            agentList: async () => [
                {
                    agentId: "a1",
                    path: "/u1/agent/claude",
                    kind: "agent",
                    name: "claude",
                    description: "Main assistant",
                    connector: null,
                    foreground: false,
                    lifecycle: "active",
                    createdAt: 1_700_000_000_000,
                    updatedAt: 1_700_000_000_000
                }
            ]
        });

        expect(result).toEqual({
            ok: true,
            agents: [
                {
                    agentId: "a1",
                    path: "/u1/agent/claude",
                    kind: "agent",
                    name: "claude",
                    description: "Main assistant",
                    connector: null,
                    foreground: false,
                    lifecycle: "active",
                    createdAt: 1_700_000_000_000,
                    updatedAt: 1_700_000_000_000
                }
            ]
        });
    });

    it("returns empty list", async () => {
        const ctx = contextForUser({ userId: "u1" });
        const result = await agentsList({
            ctx,
            agentList: async () => []
        });

        expect(result).toEqual({ ok: true, agents: [] });
    });

    it("filters out items from another user when userId is present", async () => {
        const ctx = contextForUser({ userId: "u1" });
        const result = await agentsList({
            ctx,
            agentList: async () => [
                {
                    agentId: "a1",
                    path: "/u1/agent/claude",
                    kind: "agent",
                    name: "claude",
                    description: null,
                    connector: null,
                    foreground: false,
                    lifecycle: "active",
                    createdAt: 1,
                    updatedAt: 1,
                    userId: "u1"
                },
                {
                    agentId: "a2",
                    path: "/u2/telegram",
                    kind: "connector",
                    name: null,
                    description: null,
                    connector: { name: "telegram", key: "456" },
                    foreground: true,
                    lifecycle: "active",
                    createdAt: 2,
                    updatedAt: 2,
                    userId: "u2"
                }
            ]
        });

        expect(result).toEqual({
            ok: true,
            agents: [
                {
                    agentId: "a1",
                    path: "/u1/agent/claude",
                    kind: "agent",
                    name: "claude",
                    description: null,
                    connector: null,
                    foreground: false,
                    lifecycle: "active",
                    createdAt: 1,
                    updatedAt: 1
                }
            ]
        });
    });
});
