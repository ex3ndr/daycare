import { describe, expect, it } from "vitest";
import { storageOpenTest } from "../../../storage/storageOpenTest.js";
import { contextForAgent } from "../../agents/context.js";
import { fragmentUpdateToolBuild } from "./fragmentUpdateToolBuild.js";

const toolCall = { id: "tool-1", name: "fragment_update" };

function contextBuild(storage: Awaited<ReturnType<typeof storageOpenTest>>) {
    const ctx = contextForAgent({ userId: "user-1", agentId: "agent-1" });
    return {
        ctx,
        storage,
        agentSystem: { storage },
        agent: {}
    } as never;
}

describe("fragmentUpdateToolBuild", () => {
    it("updates an existing fragment and returns the new version", async () => {
        const storage = await storageOpenTest();
        try {
            const ctx = contextForAgent({ userId: "user-1", agentId: "agent-1" });
            await storage.fragments.create(ctx, {
                id: "fragment-1",
                kitVersion: "1",
                title: "Profile Card",
                description: "Original",
                spec: { root: "main", elements: { main: { type: "Text", props: { text: "old" }, children: [] } } },
                createdAt: 1,
                updatedAt: 1
            });

            const tool = fragmentUpdateToolBuild();
            const result = await tool.execute(
                {
                    fragmentId: "fragment-1",
                    title: "Profile Card V2",
                    description: "Updated",
                    spec: { root: "main", elements: { main: { type: "Text", props: { text: "new" }, children: [] } } }
                },
                contextBuild(storage),
                toolCall
            );

            expect(result.typedResult.fragmentId).toBe("fragment-1");
            expect(result.typedResult.version).toBe(2);
            const saved = await storage.fragments.findById(ctx, "fragment-1");
            expect(saved?.title).toBe("Profile Card V2");
            expect(saved?.description).toBe("Updated");
            expect(saved?.spec).toEqual({
                root: "main",
                elements: { main: { type: "Text", props: { text: "new" }, children: [] } }
            });
        } finally {
            storage.connection.close();
        }
    });

    it("throws when fragment id is missing or no fields are provided", async () => {
        const storage = await storageOpenTest();
        try {
            const tool = fragmentUpdateToolBuild();
            const context = contextBuild(storage);

            await expect(tool.execute({ fragmentId: "  " }, context, toolCall)).rejects.toThrow(
                "fragmentId is required."
            );
            await expect(tool.execute({ fragmentId: "fragment-1" }, context, toolCall)).rejects.toThrow(
                "At least one field is required: title, description, spec, or kitVersion."
            );
        } finally {
            storage.connection.close();
        }
    });

    it("throws when fragment is not found", async () => {
        const storage = await storageOpenTest();
        try {
            const tool = fragmentUpdateToolBuild();
            await expect(
                tool.execute({ fragmentId: "missing", title: "Updated" }, contextBuild(storage), toolCall)
            ).rejects.toThrow("Fragment not found: missing");
        } finally {
            storage.connection.close();
        }
    });
});
