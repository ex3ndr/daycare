import { describe, expect, it } from "vitest";
import { storageOpenTest } from "../../../storage/storageOpenTest.js";
import { contextForAgent } from "../../agents/context.js";
import { fragmentRestoreToolBuild } from "./fragmentRestoreToolBuild.js";

const toolCall = { id: "tool-1", name: "fragment_restore" };

function contextBuild(storage: Awaited<ReturnType<typeof storageOpenTest>>) {
    const ctx = contextForAgent({ userId: "user-1", agentId: "agent-1" });
    return {
        ctx,
        storage,
        agentSystem: { storage },
        agent: {}
    } as never;
}

describe("fragmentRestoreToolBuild", () => {
    it("restores an archived fragment by id", async () => {
        const storage = await storageOpenTest();
        try {
            const ctx = contextForAgent({ userId: "user-1", agentId: "agent-1" });
            await storage.fragments.create(ctx, {
                id: "fragment-1",
                kitVersion: "1",
                title: "Restore Me",
                description: "",
                spec: { type: "Text", text: "to restore" },
                createdAt: 1,
                updatedAt: 1
            });
            await storage.fragments.archive(ctx, "fragment-1");

            const tool = fragmentRestoreToolBuild();
            const result = await tool.execute({ fragmentId: "fragment-1" }, contextBuild(storage), toolCall);

            expect(result.typedResult.fragmentId).toBe("fragment-1");
            const active = await storage.fragments.findById(ctx, "fragment-1");
            expect(active).not.toBeNull();
            expect(active?.archived).toBe(false);
        } finally {
            storage.connection.close();
        }
    });

    it("throws when fragment is not found", async () => {
        const storage = await storageOpenTest();
        try {
            const tool = fragmentRestoreToolBuild();
            await expect(tool.execute({ fragmentId: "missing" }, contextBuild(storage), toolCall)).rejects.toThrow(
                "Fragment not found: missing"
            );
        } finally {
            storage.connection.close();
        }
    });

    it("throws when fragment is not archived", async () => {
        const storage = await storageOpenTest();
        try {
            const ctx = contextForAgent({ userId: "user-1", agentId: "agent-1" });
            await storage.fragments.create(ctx, {
                id: "fragment-1",
                kitVersion: "1",
                title: "Active Fragment",
                description: "",
                spec: { type: "Text", text: "not archived" },
                createdAt: 1,
                updatedAt: 1
            });

            const tool = fragmentRestoreToolBuild();
            await expect(tool.execute({ fragmentId: "fragment-1" }, contextBuild(storage), toolCall)).rejects.toThrow(
                "Fragment is not archived: fragment-1"
            );
        } finally {
            storage.connection.close();
        }
    });
});
