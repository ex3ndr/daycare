import { describe, expect, it } from "vitest";
import { contextForAgent } from "../engine/agents/context.js";
import { type DocumentBodyRefsRepo, documentBodyRefs } from "./documentBodyRefs.js";

describe("documentBodyRefs", () => {
    it("extracts and resolves wiki links", async () => {
        const ctx = contextForAgent({ userId: "user-1", agentId: "agent-1" });
        const pathToId = new Map<string, string>([
            ["null:memory", "doc-memory"],
            ["doc-memory:daily", "doc-daily"]
        ]);
        const byId = new Set<string>(["doc-id"]);
        const repo: DocumentBodyRefsRepo = {
            findById: async (_ctx, id) => (byId.has(id) ? { id } : null),
            findBySlugAndParent: async (_ctx, slug, parentId) => {
                const id = pathToId.get(`${parentId ?? "null"}:${slug}`);
                return id ? { id } : null;
            }
        };

        const body = [
            "See [[doc-id]] and [[vault://memory/daily]].",
            "Also [[vault://memory/daily|daily notes]] and [[missing]].",
            "Duplicate [[doc-id]] should be ignored."
        ].join(" ");

        const refs = await documentBodyRefs(body, ctx, repo);
        expect(refs).toEqual(["doc-id", "doc-daily"]);
    });

    it("requires vault:// for wiki-link path targets", async () => {
        const ctx = contextForAgent({ userId: "user-1", agentId: "agent-1" });
        const pathToId = new Map<string, string>([
            ["null:memory", "doc-memory"],
            ["doc-memory:daily", "doc-daily"]
        ]);
        const repo: DocumentBodyRefsRepo = {
            findById: async () => null,
            findBySlugAndParent: async (_ctx, slug, parentId) => {
                const id = pathToId.get(`${parentId ?? "null"}:${slug}`);
                return id ? { id } : null;
            }
        };

        const refs = await documentBodyRefs("[[memory/daily]] [[~/memory/daily]] [[vault://memory/daily]]", ctx, repo);
        expect(refs).toEqual(["doc-daily"]);
    });

    it("still resolves legacy doc:// wiki-link targets from stored content", async () => {
        const ctx = contextForAgent({ userId: "user-1", agentId: "agent-1" });
        const pathToId = new Map<string, string>([
            ["null:document", "doc-root"],
            ["doc-root:mission", "doc-mission"]
        ]);
        const repo: DocumentBodyRefsRepo = {
            findById: async () => null,
            findBySlugAndParent: async (_ctx, slug, parentId) => {
                const id = pathToId.get(`${parentId ?? "null"}:${slug}`);
                return id ? { id } : null;
            }
        };

        const refs = await documentBodyRefs("[[doc://document/mission]]", ctx, repo);
        expect(refs).toEqual(["doc-mission"]);
    });

    it("returns empty list when no links resolve", async () => {
        const ctx = contextForAgent({ userId: "user-1", agentId: "agent-1" });
        const repo: DocumentBodyRefsRepo = {
            findById: async () => null,
            findBySlugAndParent: async () => null
        };

        const refs = await documentBodyRefs("No refs here [[ ]].", ctx, repo);
        expect(refs).toEqual([]);
    });

    it("does not leak regex state across calls after an error", async () => {
        const ctx = contextForAgent({ userId: "user-1", agentId: "agent-1" });
        let throwOnDoc2 = true;
        const repo: DocumentBodyRefsRepo = {
            findById: async (_ctx, id) => {
                if (id === "doc2" && throwOnDoc2) {
                    throw new Error("boom");
                }
                return { id };
            },
            findBySlugAndParent: async () => null
        };

        await expect(documentBodyRefs("[[doc1]] [[doc2]]", ctx, repo)).rejects.toThrow("boom");
        throwOnDoc2 = false;
        await expect(documentBodyRefs("[[doc1]]", ctx, repo)).resolves.toEqual(["doc1"]);
    });
});
