import { describe, expect, it } from "vitest";
import { storageOpenTest } from "../../../storage/storageOpenTest.js";
import { contextForAgent } from "../../agents/context.js";
import { fragmentCreateToolBuild } from "./fragmentCreateToolBuild.js";

const toolCall = { id: "tool-1", name: "fragment_create" };

function contextBuild(storage: Awaited<ReturnType<typeof storageOpenTest>>) {
    const ctx = contextForAgent({ userId: "user-1", agentId: "agent-1" });
    return {
        ctx,
        storage,
        agentSystem: { storage },
        agent: {}
    } as never;
}

describe("fragmentCreateToolBuild", () => {
    it("creates a fragment and returns id and version", async () => {
        const storage = await storageOpenTest();
        try {
            const tool = fragmentCreateToolBuild();
            const result = await tool.execute(
                {
                    title: "Profile Card",
                    kitVersion: "1",
                    description: "Shows profile summary",
                    spec: {
                        root: "main",
                        elements: {
                            main: { type: "View", props: {}, children: ["txt"] },
                            txt: { type: "Text", props: { text: "Hello" }, children: [] }
                        }
                    }
                },
                contextBuild(storage),
                toolCall
            );

            expect(result.toolMessage.isError).toBe(false);
            expect(result.typedResult.fragmentId).toMatch(/^[a-z0-9]+$/);
            expect(result.typedResult.version).toBe(1);

            const fragmentId = result.typedResult.fragmentId;
            if (typeof fragmentId !== "string") {
                throw new Error("Expected fragmentId to be a string.");
            }
            const saved = await storage.fragments.findById(
                contextForAgent({ userId: "user-1", agentId: "agent-1" }),
                fragmentId
            );
            expect(saved).not.toBeNull();
            expect(saved?.title).toBe("Profile Card");
            expect(saved?.kitVersion).toBe("1");
            expect(saved?.description).toBe("Shows profile summary");
            expect(saved?.spec).toEqual({
                root: "main",
                elements: {
                    main: { type: "View", props: {}, children: ["txt"] },
                    txt: { type: "Text", props: { text: "Hello" }, children: [] }
                }
            });
        } finally {
            storage.connection.close();
        }
    });

    it("rejects missing required fields", async () => {
        const storage = await storageOpenTest();
        try {
            const tool = fragmentCreateToolBuild();
            const context = contextBuild(storage);

            await expect(tool.execute({ kitVersion: "1", spec: {} }, context, toolCall)).rejects.toThrow(
                "title is required."
            );
            await expect(tool.execute({ title: "X", spec: {} }, context, toolCall)).rejects.toThrow(
                "kitVersion is required."
            );
            await expect(tool.execute({ title: "X", kitVersion: "1", spec: null }, context, toolCall)).rejects.toThrow(
                "spec is required."
            );
        } finally {
            storage.connection.close();
        }
    });

    it("rejects broken fragment python code", async () => {
        const storage = await storageOpenTest();
        try {
            const tool = fragmentCreateToolBuild();

            await expect(
                tool.execute(
                    {
                        title: "Broken Card",
                        kitVersion: "1",
                        spec: {
                            root: "main",
                            code: "def init(:\n    return {}",
                            elements: {
                                main: { type: "View", props: {}, children: [] }
                            }
                        }
                    },
                    contextBuild(storage),
                    toolCall
                )
            ).rejects.toThrow("Fragment Python syntax error.");
        } finally {
            storage.connection.close();
        }
    });
});
