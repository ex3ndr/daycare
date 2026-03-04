import { describe, expect, it } from "vitest";
import { storageOpenTest } from "../../../storage/storageOpenTest.js";
import { contextForAgent } from "../../agents/context.js";
import { fragmentListToolBuild } from "./fragmentListToolBuild.js";

const toolCall = { id: "tool-1", name: "fragment_list" };

function contextBuild(storage: Awaited<ReturnType<typeof storageOpenTest>>) {
    const ctx = contextForAgent({ userId: "user-1", agentId: "agent-1" });
    return {
        ctx,
        storage,
        agentSystem: { storage },
        agent: {}
    } as never;
}

describe("fragmentListToolBuild", () => {
    it("returns an empty list when no fragments exist", async () => {
        const storage = await storageOpenTest();
        try {
            const tool = fragmentListToolBuild();
            const result = await tool.execute({}, contextBuild(storage), toolCall);

            expect(result.typedResult.fragments).toEqual([]);
            expect(result.typedResult.summary).toBe("Found 0 fragments.");
        } finally {
            storage.connection.close();
        }
    });

    it("lists active non-archived fragments without spec payloads", async () => {
        const storage = await storageOpenTest();
        try {
            const ctx = contextForAgent({ userId: "user-1", agentId: "agent-1" });
            await storage.fragments.create(ctx, {
                id: "fragment-active",
                kitVersion: "1",
                title: "Active",
                description: "Visible fragment",
                spec: { type: "Text", text: "keep out of list payload" },
                createdAt: 100,
                updatedAt: 100
            });
            await storage.fragments.create(ctx, {
                id: "fragment-archived",
                kitVersion: "1",
                title: "Archived",
                description: "Hidden fragment",
                spec: { type: "Text", text: "hidden" },
                createdAt: 200,
                updatedAt: 200
            });
            await storage.fragments.archive(ctx, "fragment-archived");

            const tool = fragmentListToolBuild();
            const result = await tool.execute({}, contextBuild(storage), toolCall);

            expect(result.typedResult.fragments).toEqual([
                {
                    id: "fragment-active",
                    kitVersion: "1",
                    title: "Active",
                    description: "Visible fragment",
                    version: 1,
                    createdAt: 100,
                    updatedAt: 100
                }
            ]);
            expect(result.typedResult.summary).toContain("fragment-active: Active (v1, kit 1)");
            expect(result.typedResult.fragments[0]).not.toHaveProperty("spec");
        } finally {
            storage.connection.close();
        }
    });
});
