import { describe, expect, it } from "vitest";
import { storageOpenTest } from "../../../storage/storageOpenTest.js";
import { contextForAgent } from "../../agents/context.js";
import { fragmentReadToolBuild } from "./fragmentReadToolBuild.js";

const toolCall = { id: "tool-1", name: "fragment_read" };

function contextBuild(storage: Awaited<ReturnType<typeof storageOpenTest>>) {
    const ctx = contextForAgent({ userId: "user-1", agentId: "agent-1" });
    return {
        ctx,
        storage,
        agentSystem: { storage },
        agent: {}
    } as never;
}

describe("fragmentReadToolBuild", () => {
    it("reads a fragment by id including archived versions", async () => {
        const storage = await storageOpenTest();
        try {
            const ctx = contextForAgent({ userId: "user-1", agentId: "agent-1" });
            await storage.fragments.create(ctx, {
                id: "fragment-1",
                kitVersion: "1",
                title: "Profile Card",
                description: "Original",
                spec: { type: "Text", text: "Hello" },
                createdAt: 10,
                updatedAt: 10
            });
            await storage.fragments.archive(ctx, "fragment-1");

            const tool = fragmentReadToolBuild();
            const result = await tool.execute({ fragmentId: "fragment-1" }, contextBuild(storage), toolCall);

            expect(result.typedResult.fragment?.id).toBe("fragment-1");
            expect(result.typedResult.fragment?.archived).toBe(true);
            expect(result.typedResult.fragment?.version).toBe(2);
            expect(result.typedResult.fragment?.spec).toEqual({ type: "Text", text: "Hello" });
            expect(result.toolMessage.content[0]).toEqual(
                expect.objectContaining({ text: expect.stringContaining("```json") })
            );
        } finally {
            storage.connection.close();
        }
    });

    it("returns null fragment when id is not found", async () => {
        const storage = await storageOpenTest();
        try {
            const tool = fragmentReadToolBuild();
            const result = await tool.execute({ fragmentId: "missing" }, contextBuild(storage), toolCall);

            expect(result.typedResult.fragment).toBeNull();
            expect(result.typedResult.summary).toBe("Fragment not found: missing.");
        } finally {
            storage.connection.close();
        }
    });
});
