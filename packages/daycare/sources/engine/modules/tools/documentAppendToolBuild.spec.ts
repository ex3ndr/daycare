import { describe, expect, it } from "vitest";

import { storageOpenTest } from "../../../storage/storageOpenTest.js";
import { contextForAgent } from "../../agents/context.js";
import { documentAppendToolBuild } from "./documentAppendToolBuild.js";

const toolCall = { id: "tc-append", name: "document_append" };

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

describe("documentAppendToolBuild", () => {
    it("appends text to an existing document by id", async () => {
        const storage = await storageOpenTest();
        try {
            const ctx = contextForAgent({ userId: "user-1", agentId: "agent-1" });
            await storage.documents.create(ctx, {
                id: "doc-1",
                slug: "notes",
                title: "Notes",
                description: "Scratch",
                body: "line 1",
                createdAt: 1,
                updatedAt: 1
            });

            const tool = documentAppendToolBuild();
            const result = await tool.execute(
                { documentId: "doc-1", text: "\nline 2" },
                contextBuild(storage),
                toolCall
            );

            expect(result.typedResult.documentId).toBe("doc-1");
            expect(result.typedResult.version).toBe(2);
            const updated = await storage.documents.findById(ctx, "doc-1");
            expect(updated?.body).toBe("line 1\nline 2");
        } finally {
            storage.connection.close();
        }
    });

    it("appends text by path", async () => {
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

            const tool = documentAppendToolBuild();
            await tool.execute({ path: "doc://notes", text: " world" }, contextBuild(storage), toolCall);

            const updated = await storage.documents.findById(ctx, "doc-1");
            expect(updated?.body).toBe("hello world");
        } finally {
            storage.connection.close();
        }
    });

    it("rejects invalid selector combinations", async () => {
        const storage = await storageOpenTest();
        try {
            const tool = documentAppendToolBuild();
            await expect(
                tool.execute({ documentId: "doc-1", path: "doc://notes", text: "x" }, contextBuild(storage), toolCall)
            ).rejects.toThrow("Provide either documentId or path, not both.");

            await expect(tool.execute({ text: "x" }, contextBuild(storage), toolCall)).rejects.toThrow(
                "Provide either documentId or path."
            );
        } finally {
            storage.connection.close();
        }
    });

    it("enforces memory-agent scope to doc://memory", async () => {
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

            const tool = documentAppendToolBuild();
            await expect(
                tool.execute({ documentId: "doc-1", text: " world" }, contextBuild(storage, "memory"), toolCall)
            ).rejects.toThrow("Memory agents can only write inside doc://memory or doc://system/memory.");
        } finally {
            storage.connection.close();
        }
    });
});
