import { describe, expect, it } from "vitest";
import { storageOpenTest } from "../../../storage/storageOpenTest.js";
import { contextForAgent } from "../../agents/context.js";
import { documentWriteToolBuild } from "./documentWriteToolBuild.js";

const toolCall = { id: "tc1", name: "document_write" };

function contextBuild(storage: Awaited<ReturnType<typeof storageOpenTest>>) {
    return {
        ctx: contextForAgent({ userId: "user-1", agentId: "agent-1" }),
        storage,
        agentSystem: { storage }
    } as never;
}

describe("documentWriteToolBuild", () => {
    it("creates a document when documentId is omitted", async () => {
        const storage = await storageOpenTest();
        try {
            const tool = documentWriteToolBuild();
            const result = await tool.execute(
                {
                    slug: "memory",
                    title: "Memory",
                    description: "Memory root",
                    body: "Root body"
                },
                contextBuild(storage),
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
                contextBuild(storage),
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
            const result = await tool.execute(
                {
                    slug: "user",
                    title: "User",
                    description: "User facts",
                    body: "Prefers concise answers.",
                    parentPath: "~/memory"
                },
                contextBuild(storage),
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
                    contextBuild(storage),
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
                    contextBuild(storage),
                    toolCall
                )
            ).rejects.toThrow("different parent documents");
        } finally {
            storage.connection.close();
        }
    });
});
