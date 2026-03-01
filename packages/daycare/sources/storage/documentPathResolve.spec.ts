import { describe, expect, it } from "vitest";
import { contextForAgent } from "../engine/agents/context.js";
import { type DocumentPathResolveRepo, documentPathResolve } from "./documentPathResolve.js";

describe("documentPathResolve", () => {
    it("builds a nested path from parent chain", async () => {
        const ctx = contextForAgent({ userId: "user-1", agentId: "agent-1" });
        const docs = new Map<string, { id: string; slug: string }>([
            ["doc-memory", { id: "doc-memory", slug: "memory" }],
            ["doc-daily", { id: "doc-daily", slug: "daily" }],
            ["doc-events", { id: "doc-events", slug: "events" }]
        ]);
        const parents = new Map<string, string | null>([
            ["doc-memory", null],
            ["doc-daily", "doc-memory"],
            ["doc-events", "doc-daily"]
        ]);
        const repo: DocumentPathResolveRepo = {
            findById: async (_ctx, id) => docs.get(id) ?? null,
            findParentId: async (_ctx, id) => parents.get(id) ?? null
        };

        const resolved = await documentPathResolve(ctx, "doc-events", repo);
        expect(resolved).toBe("~/memory/daily/events");
    });

    it("returns null when document is missing", async () => {
        const ctx = contextForAgent({ userId: "user-1", agentId: "agent-1" });
        const repo: DocumentPathResolveRepo = {
            findById: async () => null,
            findParentId: async () => null
        };

        expect(await documentPathResolve(ctx, "missing", repo)).toBeNull();
    });

    it("throws on parent cycles", async () => {
        const ctx = contextForAgent({ userId: "user-1", agentId: "agent-1" });
        const repo: DocumentPathResolveRepo = {
            findById: async (_ctx, id) => ({ id, slug: id }),
            findParentId: async (_ctx, id) => (id === "doc-a" ? "doc-b" : "doc-a")
        };

        await expect(documentPathResolve(ctx, "doc-a", repo)).rejects.toThrow("cycle");
    });
});
