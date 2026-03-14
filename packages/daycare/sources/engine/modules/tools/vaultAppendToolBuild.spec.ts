import { describe, expect, it } from "vitest";

import { storageOpenTest } from "../../../storage/storageOpenTest.js";
import { contextForAgent } from "../../agents/context.js";
import { vaultAppendToolBuild } from "./vaultAppendToolBuild.js";

const toolCall = { id: "tc-append", name: "vault_append" };

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

describe("vaultAppendToolBuild", () => {
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

            const tool = vaultAppendToolBuild();
            const result = await tool.execute({ vaultId: "doc-1", text: "\nline 2" }, contextBuild(storage), toolCall);

            expect(result.typedResult.vaultId).toBe("doc-1");
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

            const tool = vaultAppendToolBuild();
            await tool.execute({ path: "vault://notes", text: " world" }, contextBuild(storage), toolCall);

            const updated = await storage.documents.findById(ctx, "doc-1");
            expect(updated?.body).toBe("hello world");
        } finally {
            storage.connection.close();
        }
    });

    it("rejects invalid selector combinations", async () => {
        const storage = await storageOpenTest();
        try {
            const tool = vaultAppendToolBuild();
            await expect(
                tool.execute({ vaultId: "doc-1", path: "vault://notes", text: "x" }, contextBuild(storage), toolCall)
            ).rejects.toThrow("Provide either vaultId or path, not both.");

            await expect(tool.execute({ text: "x" }, contextBuild(storage), toolCall)).rejects.toThrow(
                "Provide either vaultId or path."
            );
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

            const tool = vaultAppendToolBuild();
            await expect(
                tool.execute({ vaultId: "doc-1", text: " world" }, contextBuild(storage, "memory"), toolCall)
            ).rejects.toThrow(
                "Memory agents can only write inside vault://memory. Compactor agents may also update vault://system/memory/agent and vault://system/memory/compactor."
            );
        } finally {
            storage.connection.close();
        }
    });
});
