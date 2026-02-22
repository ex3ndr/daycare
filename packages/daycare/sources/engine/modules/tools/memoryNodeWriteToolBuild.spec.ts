import { describe, expect, it } from "vitest";

import type { GraphNode } from "../../memory/graph/graphTypes.js";
import { memoryNodeWriteToolBuild } from "./memoryNodeWriteToolBuild.js";

function makeContext(existingNode: GraphNode | null) {
    const written: GraphNode[] = [];
    return {
        context: {
            memory: {
                readNode: async () => existingNode,
                writeNode: async (_userId: string, node: GraphNode) => {
                    written.push(node);
                }
            },
            ctx: { agentId: "agent-1", userId: "user-1" }
        } as never,
        written
    };
}

describe("memoryNodeWriteToolBuild", () => {
    const tool = memoryNodeWriteToolBuild();

    it("creates a new node when none exists", async () => {
        const { context, written } = makeContext(null);
        const result = await tool.execute(
            {
                nodeId: "user-prefs",
                title: "User Preferences",
                path: ["user"],
                content: "Prefers dark mode."
            },
            context,
            { id: "tc1", name: "memory_node_write" }
        );
        expect(result.typedResult.summary).toContain("Created");
        expect(result.typedResult.nodeId).toBe("user-prefs");
        expect(written).toHaveLength(1);
        expect(written[0]!.frontmatter.title).toBe("User Preferences");
        expect(written[0]!.content).toBe("Prefers dark mode.");
    });

    it("updates existing node and preserves createdAt", async () => {
        const existing: GraphNode = {
            id: "user-prefs",
            frontmatter: {
                title: "Old Title",
                description: "",
                path: ["user"],
                createdAt: 1000,
                updatedAt: 1500
            },
            content: "Old content",
            refs: []
        };
        const { context, written } = makeContext(existing);
        const result = await tool.execute(
            {
                nodeId: "user-prefs",
                title: "User Preferences",
                path: ["user"],
                content: "Updated content."
            },
            context,
            { id: "tc1", name: "memory_node_write" }
        );
        expect(result.typedResult.summary).toContain("Updated");
        expect(written[0]!.frontmatter.createdAt).toBe(1000);
    });

    it("rejects reserved node ids", async () => {
        const { context } = makeContext(null);
        await expect(
            tool.execute({ nodeId: "__root__", title: "Root", path: [], content: "x" }, context, {
                id: "tc1",
                name: "memory_node_write"
            })
        ).rejects.toThrow("reserved");
    });

    it("throws when memory is not available", async () => {
        const ctx = { ctx: { agentId: "a", userId: "u" } } as never;
        await expect(
            tool.execute({ nodeId: "x", title: "T", path: [], content: "c" }, ctx, {
                id: "tc1",
                name: "memory_node_write"
            })
        ).rejects.toThrow("Memory is not available");
    });
});
