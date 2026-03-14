import { describe, expect, it } from "vitest";
import { contextForAgent } from "../engine/agents/context.js";
import { type VaultPathFindRepo, vaultPathFind } from "./vaultPathFind.js";

describe("vaultPathFind", () => {
    it("resolves nested paths", async () => {
        const ctx = contextForAgent({ userId: "user-1", agentId: "agent-1" });
        const ids = new Map<string, string>([
            ["null:document", "doc-root"],
            ["null:memory", "doc-memory"],
            ["doc-memory:daily", "doc-daily"],
            ["doc-daily:events", "doc-events"],
            ["doc-root:mission", "doc-mission"]
        ]);
        const repo: VaultPathFindRepo = {
            findBySlugAndParent: async (_ctx, slug, parentId) => {
                const key = `${parentId ?? "null"}:${slug}`;
                const id = ids.get(key);
                return id ? { id } : null;
            }
        };

        const resolved = await vaultPathFind(ctx, "vault://memory/daily/events", repo);
        expect(resolved).toBe("doc-events");
        expect(await vaultPathFind(ctx, "vault://vault/mission", repo)).toBe("doc-mission");
        expect(await vaultPathFind(ctx, "doc://document/mission", repo)).toBe("doc-mission");
        expect(await vaultPathFind(ctx, "~/memory/daily/events", repo)).toBeNull();
    });

    it("returns null for invalid or partial paths", async () => {
        const ctx = contextForAgent({ userId: "user-1", agentId: "agent-1" });
        const repo: VaultPathFindRepo = {
            findBySlugAndParent: async () => null
        };

        expect(await vaultPathFind(ctx, "memory/daily", repo)).toBeNull();
        expect(await vaultPathFind(ctx, "vault://", repo)).toBeNull();
        expect(await vaultPathFind(ctx, "vault://memory", repo)).toBeNull();
    });
});
