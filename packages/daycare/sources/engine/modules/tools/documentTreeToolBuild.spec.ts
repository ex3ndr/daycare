import { describe, expect, it } from "vitest";
import { storageOpenTest } from "../../../storage/storageOpenTest.js";
import { contextForAgent } from "../../agents/context.js";
import { documentTreeToolBuild } from "./documentTreeToolBuild.js";

const toolCall = { id: "tc-tree", name: "document_tree" };

function contextBuild(storage: Awaited<ReturnType<typeof storageOpenTest>>, readVersions: Map<string, number>) {
    return {
        ctx: contextForAgent({ userId: "user-1", agentId: "agent-1" }),
        storage,
        agentSystem: { storage },
        agent: {
            documentChainReadMark: (entries: Array<{ id: string; version: number }>) => {
                for (const entry of entries) {
                    readVersions.set(entry.id, entry.version);
                }
            }
        }
    } as never;
}

describe("documentTreeToolBuild", () => {
    it("returns a structured subtree for a selected path", async () => {
        const storage = await storageOpenTest();
        const readVersions = new Map<string, number>();
        try {
            const ctx = contextForAgent({ userId: "user-1", agentId: "agent-1" });
            await storage.documents.create(ctx, {
                id: "memory",
                slug: "memory",
                title: "Memory",
                description: "Memory root",
                body: "",
                createdAt: 1,
                updatedAt: 1
            });
            await storage.documents.create(ctx, {
                id: "user",
                slug: "user",
                title: "User",
                description: "User facts",
                body: "",
                createdAt: 2,
                updatedAt: 2,
                parentId: "memory"
            });
            await storage.documents.create(ctx, {
                id: "prefs",
                slug: "prefs",
                title: "Prefs",
                description: "Preferences",
                body: "",
                createdAt: 3,
                updatedAt: 3,
                parentId: "user"
            });

            const tool = documentTreeToolBuild();
            const result = await tool.execute({ path: "doc://memory" }, contextBuild(storage, readVersions), toolCall);

            expect(result.typedResult.found).toBe(true);
            expect(result.typedResult.rootDocumentId).toBe("memory");
            expect(result.typedResult.documents).toEqual([
                {
                    documentId: "memory",
                    parentDocumentId: null,
                    title: "Memory",
                    slug: "memory",
                    path: "doc://memory",
                    updatedAt: 1,
                    depth: 0
                },
                {
                    documentId: "user",
                    parentDocumentId: "memory",
                    title: "User",
                    slug: "user",
                    path: "doc://memory/user",
                    updatedAt: 2,
                    depth: 1
                },
                {
                    documentId: "prefs",
                    parentDocumentId: "user",
                    title: "Prefs",
                    slug: "prefs",
                    path: "doc://memory/user/prefs",
                    updatedAt: 3,
                    depth: 2
                }
            ]);
            expect(readVersions.get("memory")).toBe(1);
        } finally {
            storage.connection.close();
        }
    });

    it("returns all root trees when no selector is provided", async () => {
        const storage = await storageOpenTest();
        const readVersions = new Map<string, number>();
        try {
            const ctx = contextForAgent({ userId: "user-1", agentId: "agent-1" });
            await storage.documents.create(ctx, {
                id: "memory",
                slug: "memory",
                title: "Memory",
                description: "Memory root",
                body: "",
                createdAt: 1,
                updatedAt: 1
            });
            await storage.documents.create(ctx, {
                id: "work",
                slug: "work",
                title: "Work",
                description: "Work root",
                body: "",
                createdAt: 2,
                updatedAt: 2
            });

            const tool = documentTreeToolBuild();
            const result = await tool.execute({}, contextBuild(storage, readVersions), toolCall);

            expect(result.typedResult.found).toBe(true);
            expect(result.typedResult.documents).toHaveLength(2);
            expect(result.typedResult.summary).toContain("# Root Document Trees");
        } finally {
            storage.connection.close();
        }
    });
});
