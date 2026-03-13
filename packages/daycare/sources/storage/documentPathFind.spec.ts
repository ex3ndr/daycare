import { describe, expect, it } from "vitest";
import { contextForAgent } from "../engine/agents/context.js";
import { type DocumentPathFindRepo, documentPathFind } from "./documentPathFind.js";

describe("documentPathFind", () => {
    it("resolves nested paths", async () => {
        const ctx = contextForAgent({ userId: "user-1", agentId: "agent-1" });
        const ids = new Map<string, string>([
            ["null:document", "doc-root"],
            ["null:memory", "doc-memory"],
            ["doc-memory:daily", "doc-daily"],
            ["doc-daily:events", "doc-events"],
            ["doc-root:mission", "doc-mission"]
        ]);
        const repo: DocumentPathFindRepo = {
            findBySlugAndParent: async (_ctx, slug, parentId) => {
                const key = `${parentId ?? "null"}:${slug}`;
                const id = ids.get(key);
                return id ? { id } : null;
            }
        };

        const resolved = await documentPathFind(ctx, "vault://memory/daily/events", repo);
        expect(resolved).toBe("doc-events");
        expect(await documentPathFind(ctx, "vault://vault/mission", repo)).toBe("doc-mission");
        expect(await documentPathFind(ctx, "doc://document/mission", repo)).toBe("doc-mission");
        expect(await documentPathFind(ctx, "~/memory/daily/events", repo)).toBeNull();
    });

    it("returns null for invalid or partial paths", async () => {
        const ctx = contextForAgent({ userId: "user-1", agentId: "agent-1" });
        const repo: DocumentPathFindRepo = {
            findBySlugAndParent: async () => null
        };

        expect(await documentPathFind(ctx, "memory/daily", repo)).toBeNull();
        expect(await documentPathFind(ctx, "vault://", repo)).toBeNull();
        expect(await documentPathFind(ctx, "vault://memory", repo)).toBeNull();
    });
});
