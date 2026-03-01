import { describe, expect, it } from "vitest";
import { storageOpenTest } from "../../../storage/storageOpenTest.js";
import { contextForAgent } from "../../agents/context.js";
import { documentReadToolBuild } from "./documentReadToolBuild.js";
import { documentWriteToolBuild } from "./documentWriteToolBuild.js";

const toolCall = { id: "tc1", name: "document_write" };
const readToolCall = { id: "tc-read", name: "document_read" };

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
            },
            documentVersionLastRead: (documentId: string) => readVersions.get(documentId) ?? null
        }
    } as never;
}

describe("documentWriteToolBuild", () => {
    it("creates a document when documentId is omitted", async () => {
        const storage = await storageOpenTest();
        const readVersions = new Map<string, number>();
        try {
            const tool = documentWriteToolBuild();
            const result = await tool.execute(
                {
                    slug: "memory",
                    title: "Memory",
                    description: "Memory root",
                    body: "Root body"
                },
                contextBuild(storage, readVersions),
                toolCall
            );

            expect(result.typedResult.version).toBe(1);
            const createdId = String(result.typedResult.documentId ?? "");
            const created = await storage.documents.findById(
                contextForAgent({ userId: "user-1", agentId: "agent-1" }),
                createdId
            );
            expect(created?.slug).toBe("memory");
            expect(created?.title).toBe("Memory");
        } finally {
            storage.connection.close();
        }
    });

    it("updates a document when documentId is provided", async () => {
        const storage = await storageOpenTest();
        const readVersions = new Map<string, number>();
        try {
            const ctx = contextForAgent({ userId: "user-1", agentId: "agent-1" });
            await storage.documents.create(ctx, {
                id: "doc-1",
                slug: "memory",
                title: "Memory",
                description: "Memory root",
                body: "v1",
                createdAt: 1,
                updatedAt: 1
            });

            const tool = documentWriteToolBuild();
            const result = await tool.execute(
                {
                    documentId: "doc-1",
                    slug: "memory",
                    title: "Memory Updated",
                    description: "Memory root updated",
                    body: "v2"
                },
                contextBuild(storage, readVersions),
                toolCall
            );

            expect(result.typedResult.documentId).toBe("doc-1");
            expect(result.typedResult.version).toBe(2);
            const updated = await storage.documents.findById(ctx, "doc-1");
            expect(updated?.title).toBe("Memory Updated");
            expect(updated?.body).toBe("v2");
        } finally {
            storage.connection.close();
        }
    });

    it("creates with parentPath", async () => {
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

            const readTool = documentReadToolBuild();
            await readTool.execute({ path: "~/memory" }, contextBuild(storage, readVersions), readToolCall);

            const tool = documentWriteToolBuild();
            const result = await tool.execute(
                {
                    slug: "user",
                    title: "User",
                    description: "User facts",
                    body: "Prefers concise answers.",
                    parentPath: "~/memory"
                },
                contextBuild(storage, readVersions),
                toolCall
            );

            const parentId = await storage.documents.findParentId(ctx, String(result.typedResult.documentId ?? ""));
            expect(parentId).toBe("memory");
        } finally {
            storage.connection.close();
        }
    });

    it("returns validation errors for invalid parent arguments", async () => {
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

            const tool = documentWriteToolBuild();
            await expect(
                tool.execute(
                    {
                        slug: "user",
                        title: "User",
                        description: "User facts",
                        body: "x",
                        parentPath: "~/missing"
                    },
                    contextBuild(storage, readVersions),
                    toolCall
                )
            ).rejects.toThrow("Parent path not found");

            await expect(
                tool.execute(
                    {
                        slug: "user",
                        title: "User",
                        description: "User facts",
                        body: "x",
                        parentId: "different-parent",
                        parentPath: "~/memory"
                    },
                    contextBuild(storage, readVersions),
                    toolCall
                )
            ).rejects.toThrow("different parent documents");
        } finally {
            storage.connection.close();
        }
    });

    it("rejects path-unsafe slugs", async () => {
        const storage = await storageOpenTest();
        const readVersions = new Map<string, number>();
        try {
            const tool = documentWriteToolBuild();
            await expect(
                tool.execute(
                    {
                        slug: "user/profile",
                        title: "User",
                        description: "User facts",
                        body: "x"
                    },
                    contextBuild(storage, readVersions),
                    toolCall
                )
            ).rejects.toThrow("cannot contain '/'");
        } finally {
            storage.connection.close();
        }
    });

    it("rejects attach when the parent chain was not read", async () => {
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
                description: "User node",
                body: "",
                createdAt: 2,
                updatedAt: 2,
                parentId: "memory"
            });

            // Simulate a partial read marker: parent read but root missing.
            readVersions.set("user", 1);
            const tool = documentWriteToolBuild();
            await expect(
                tool.execute(
                    {
                        slug: "prefs",
                        title: "Prefs",
                        description: "Prefs",
                        body: "",
                        parentPath: "~/memory/user"
                    },
                    contextBuild(storage, readVersions),
                    toolCall
                )
            ).rejects.toThrow("Parent chain must be read before attach");
        } finally {
            storage.connection.close();
        }
    });

    it("rejects attach when a chain document changed after read", async () => {
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
                description: "User node",
                body: "",
                createdAt: 2,
                updatedAt: 2,
                parentId: "memory"
            });

            const readTool = documentReadToolBuild();
            await readTool.execute({ path: "~/memory/user" }, contextBuild(storage, readVersions), readToolCall);
            await storage.documents.update(ctx, "user", { body: "changed", updatedAt: 3 });

            const tool = documentWriteToolBuild();
            await expect(
                tool.execute(
                    {
                        slug: "prefs",
                        title: "Prefs",
                        description: "Prefs",
                        body: "",
                        parentPath: "~/memory/user"
                    },
                    contextBuild(storage, readVersions),
                    toolCall
                )
            ).rejects.toThrow("Parent chain changed since last read");
        } finally {
            storage.connection.close();
        }
    });
});
