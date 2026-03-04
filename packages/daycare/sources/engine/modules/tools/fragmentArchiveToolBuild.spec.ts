import { describe, expect, it } from "vitest";
import { storageOpenTest } from "../../../storage/storageOpenTest.js";
import { contextForAgent } from "../../agents/context.js";
import { fragmentArchiveToolBuild } from "./fragmentArchiveToolBuild.js";

const toolCall = { id: "tool-1", name: "fragment_archive" };

function contextBuild(storage: Awaited<ReturnType<typeof storageOpenTest>>) {
    const ctx = contextForAgent({ userId: "user-1", agentId: "agent-1" });
    return {
        ctx,
        storage,
        agentSystem: { storage },
        agent: {}
    } as never;
}

describe("fragmentArchiveToolBuild", () => {
    it("archives a fragment by id", async () => {
        const storage = await storageOpenTest();
        try {
            const ctx = contextForAgent({ userId: "user-1", agentId: "agent-1" });
            await storage.fragments.create(ctx, {
                id: "fragment-1",
                kitVersion: "1",
                title: "Archive Me",
                description: "",
                spec: { type: "Text", text: "to archive" },
                createdAt: 1,
                updatedAt: 1
            });

            const tool = fragmentArchiveToolBuild();
            const result = await tool.execute({ fragmentId: "fragment-1" }, contextBuild(storage), toolCall);

            expect(result.typedResult.fragmentId).toBe("fragment-1");
            const active = await storage.fragments.findById(ctx, "fragment-1");
            const any = await storage.fragments.findAnyById(ctx, "fragment-1");
            expect(active).toBeNull();
            expect(any?.archived).toBe(true);
        } finally {
            storage.connection.close();
        }
    });

    it("throws when fragment is not found", async () => {
        const storage = await storageOpenTest();
        try {
            const tool = fragmentArchiveToolBuild();
            await expect(tool.execute({ fragmentId: "missing" }, contextBuild(storage), toolCall)).rejects.toThrow(
                "Fragment not found: missing"
            );
        } finally {
            storage.connection.close();
        }
    });
});
