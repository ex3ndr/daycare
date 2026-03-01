import { describe, expect, it } from "vitest";
import { contextForAgent } from "../engine/agents/context.js";
import { type DocumentPathFindRepo, documentPathFind } from "./documentPathFind.js";

describe("documentPathFind", () => {
    it("resolves nested paths", async () => {
        const ctx = contextForAgent({ userId: "user-1", agentId: "agent-1" });
        const ids = new Map<string, string>([
            ["null:memory", "doc-memory"],
            ["doc-memory:daily", "doc-daily"],
            ["doc-daily:events", "doc-events"]
        ]);
        const repo: DocumentPathFindRepo = {
            findBySlugAndParent: async (_ctx, slug, parentId) => {
                const key = `${parentId ?? "null"}:${slug}`;
                const id = ids.get(key);
                return id ? { id } : null;
            }
        };

        const resolved = await documentPathFind(ctx, "~/memory/daily/events", repo);
        expect(resolved).toBe("doc-events");
    });

    it("returns null for invalid or partial paths", async () => {
        const ctx = contextForAgent({ userId: "user-1", agentId: "agent-1" });
        const repo: DocumentPathFindRepo = {
            findBySlugAndParent: async () => null
        };

        expect(await documentPathFind(ctx, "memory/daily", repo)).toBeNull();
        expect(await documentPathFind(ctx, "~/", repo)).toBeNull();
        expect(await documentPathFind(ctx, "~/memory", repo)).toBeNull();
    });
});
