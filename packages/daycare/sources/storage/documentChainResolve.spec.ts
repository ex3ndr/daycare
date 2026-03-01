import { describe, expect, it } from "vitest";
import { contextForAgent } from "../engine/agents/context.js";
import { type DocumentChainResolveRepo, documentChainResolve } from "./documentChainResolve.js";

describe("documentChainResolve", () => {
    it("resolves root-to-target chain", async () => {
        const ctx = contextForAgent({ userId: "user-1", agentId: "agent-1" });
        const docs = new Map<string, { id: string; slug: string; version?: number | null }>([
            ["memory", { id: "memory", slug: "memory", version: 2 }],
            ["daily", { id: "daily", slug: "daily", version: 3 }],
            ["events", { id: "events", slug: "events", version: 4 }]
        ]);
        const parents = new Map<string, string | null>([
            ["memory", null],
            ["daily", "memory"],
            ["events", "daily"]
        ]);
        const repo: DocumentChainResolveRepo = {
            findById: async (_ctx, id) => docs.get(id) ?? null,
            findParentId: async (_ctx, id) => parents.get(id) ?? null
        };

        const chain = await documentChainResolve(ctx, "events", repo);
        expect(chain).toEqual([
            { id: "memory", slug: "memory", version: 2 },
            { id: "daily", slug: "daily", version: 3 },
            { id: "events", slug: "events", version: 4 }
        ]);
    });

    it("returns null when a node is missing", async () => {
        const ctx = contextForAgent({ userId: "user-1", agentId: "agent-1" });
        const repo: DocumentChainResolveRepo = {
            findById: async (_ctx, id) => (id === "events" ? { id: "events", slug: "events", version: 1 } : null),
            findParentId: async (_ctx, id) => (id === "events" ? "missing" : null)
        };

        expect(await documentChainResolve(ctx, "events", repo)).toBeNull();
    });

    it("throws on parent cycles", async () => {
        const ctx = contextForAgent({ userId: "user-1", agentId: "agent-1" });
        const repo: DocumentChainResolveRepo = {
            findById: async (_ctx, id) => ({ id, slug: id, version: 1 }),
            findParentId: async (_ctx, id) => (id === "a" ? "b" : "a")
        };

        await expect(documentChainResolve(ctx, "a", repo)).rejects.toThrow("cycle");
    });
});
