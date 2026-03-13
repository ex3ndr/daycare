import { describe, expect, it } from "vitest";

import { storageOpenTest } from "../../../storage/storageOpenTest.js";
import { contextForAgent } from "../../agents/context.js";
import { documentPatchToolBuild } from "./documentPatchToolBuild.js";

const toolCall = { id: "tc-patch", name: "vault_patch" };

function contextBuild(storage: Awaited<ReturnType<typeof storageOpenTest>>, agentKind: "agent" | "memory" = "agent") {
    return {
        ctx: contextForAgent({ userId: "user-1", agentId: "agent-1" }),
        storage,
        agentSystem: { storage },
        agent: {
            config: {
                kind: agentKind
            }
        }
    } as never;
}

describe("documentPatchToolBuild", () => {
    it("replaces one exact match by document id", async () => {
        const storage = await storageOpenTest();
        try {
            const ctx = contextForAgent({ userId: "user-1", agentId: "agent-1" });
            await storage.documents.create(ctx, {
                id: "doc-1",
                slug: "notes",
                title: "Notes",
                description: "Scratch",
                body: "Hello world",
                createdAt: 1,
                updatedAt: 1
            });

            const tool = documentPatchToolBuild();
            const result = await tool.execute(
                {
                    vaultId: "doc-1",
                    patch: {
                        search: "world",
                        replace: "Daycare"
                    }
                },
                contextBuild(storage),
                toolCall
            );

            expect(result.typedResult.vaultId).toBe("doc-1");
            expect(result.typedResult.version).toBe(2);
            expect(result.typedResult.replacedCount).toBe(1);
            const updated = await storage.documents.findById(ctx, "doc-1");
            expect(updated?.body).toBe("Hello Daycare");
        } finally {
            storage.connection.close();
        }
    });

    it("replaces all matches when replaceAll=true", async () => {
        const storage = await storageOpenTest();
        try {
            const ctx = contextForAgent({ userId: "user-1", agentId: "agent-1" });
            await storage.documents.create(ctx, {
                id: "doc-1",
                slug: "notes",
                title: "Notes",
                description: "Scratch",
                body: "cat cat cat",
                createdAt: 1,
                updatedAt: 1
            });

            const tool = documentPatchToolBuild();
            const result = await tool.execute(
                {
                    path: "vault://notes",
                    patch: {
                        search: "cat",
                        replace: "dog",
                        replaceAll: true
                    }
                },
                contextBuild(storage),
                toolCall
            );

            expect(result.typedResult.replacedCount).toBe(3);
            expect(result.typedResult.matchCount).toBe(3);
            const updated = await storage.documents.findById(ctx, "doc-1");
            expect(updated?.body).toBe("dog dog dog");
        } finally {
            storage.connection.close();
        }
    });

    it("rejects ambiguous single replacement", async () => {
        const storage = await storageOpenTest();
        try {
            const ctx = contextForAgent({ userId: "user-1", agentId: "agent-1" });
            await storage.documents.create(ctx, {
                id: "doc-1",
                slug: "notes",
                title: "Notes",
                description: "Scratch",
                body: "cat cat",
                createdAt: 1,
                updatedAt: 1
            });

            const tool = documentPatchToolBuild();
            await expect(
                tool.execute(
                    {
                        vaultId: "doc-1",
                        patch: {
                            search: "cat",
                            replace: "dog"
                        }
                    },
                    contextBuild(storage),
                    toolCall
                )
            ).rejects.toThrow("Use replaceAll=true");
        } finally {
            storage.connection.close();
        }
    });

    it("rejects patch when search text is missing", async () => {
        const storage = await storageOpenTest();
        try {
            const ctx = contextForAgent({ userId: "user-1", agentId: "agent-1" });
            await storage.documents.create(ctx, {
                id: "doc-1",
                slug: "notes",
                title: "Notes",
                description: "Scratch",
                body: "hello",
                createdAt: 1,
                updatedAt: 1
            });

            const tool = documentPatchToolBuild();
            await expect(
                tool.execute(
                    {
                        vaultId: "doc-1",
                        patch: {
                            search: "missing",
                            replace: "x"
                        }
                    },
                    contextBuild(storage),
                    toolCall
                )
            ).rejects.toThrow("Patch search text was not found");
        } finally {
            storage.connection.close();
        }
    });

    it("enforces memory-agent scope to vault://memory", async () => {
        const storage = await storageOpenTest();
        try {
            const ctx = contextForAgent({ userId: "user-1", agentId: "agent-1" });
            await storage.documents.create(ctx, {
                id: "doc-1",
                slug: "notes",
                title: "Notes",
                description: "Scratch",
                body: "hello",
                createdAt: 1,
                updatedAt: 1
            });

            const tool = documentPatchToolBuild();
            await expect(
                tool.execute(
                    {
                        vaultId: "doc-1",
                        patch: {
                            search: "hello",
                            replace: "world"
                        }
                    },
                    contextBuild(storage, "memory"),
                    toolCall
                )
            ).rejects.toThrow(
                "Memory agents can only write inside vault://memory. Compactor agents may also update vault://system/memory/agent and vault://system/memory/compactor."
            );
        } finally {
            storage.connection.close();
        }
    });
});
