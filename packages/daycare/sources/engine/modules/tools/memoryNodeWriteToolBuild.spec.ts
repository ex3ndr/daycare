import { isCuid } from "@paralleldrive/cuid2";
import { describe, expect, it } from "vitest";

import type { GraphNode } from "../../memory/graph/graphTypes.js";
import { memoryNodeWriteToolBuild } from "./memoryNodeWriteToolBuild.js";

function makeContext(existingNode: GraphNode | null, parentNodes?: Map<string, GraphNode>) {
    const written: GraphNode[] = [];
    const parents = parentNodes ?? new Map<string, GraphNode>();
    return {
        context: {
            memory: {
                readNode: async (_userId: string, nodeId: string) => {
                    return parents.get(nodeId) ?? existingNode;
                },
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

    it("generates cuid2 id when nodeId is omitted", async () => {
        const { context, written } = makeContext(null);
        const result = await tool.execute(
            {
                title: "User Preferences",
                content: "Prefers dark mode.",
                parents: ["__root__"]
            },
            context,
            { id: "tc1", name: "memory_node_write" }
        );
        expect(result.typedResult.summary).toContain("Created");
        expect(isCuid(result.typedResult.nodeId as string)).toBe(true);
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
                content: "Updated content.",
                parents: ["__root__"]
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
            tool.execute({ nodeId: "__root__", title: "Root", content: "x", parents: ["__root__"] }, context, {
                id: "tc1",
                name: "memory_node_write"
            })
        ).rejects.toThrow("reserved");
    });

    it("throws when memory is not available", async () => {
        const ctx = { ctx: { agentId: "a", userId: "u" } } as never;
        await expect(
            tool.execute({ title: "T", content: "c", parents: ["__root__"] }, ctx, {
                id: "tc1",
                name: "memory_node_write"
            })
        ).rejects.toThrow("Memory is not available");
    });

    it("updates non-root parent refs to include new node", async () => {
        const parentNode: GraphNode = {
            id: "topic-a",
            frontmatter: { title: "Topic A", description: "", createdAt: 100, updatedAt: 200 },
            content: "Topic A content",
            refs: []
        };
        const parents = new Map<string, GraphNode>([["topic-a", parentNode]]);
        const { context, written } = makeContext(null, parents);

        const result = await tool.execute(
            {
                title: "Child Node",
                content: "Child content",
                parents: ["topic-a"]
            },
            context,
            { id: "tc1", name: "memory_node_write" }
        );

        expect(result.typedResult.summary).toContain("Created");
        // First write: the node itself. Second write: parent with updated refs.
        expect(written).toHaveLength(2);
        const updatedParent = written[1]!;
        expect(updatedParent.id).toBe("topic-a");
        expect(updatedParent.refs).toContain(result.typedResult.nodeId);
    });

    it("skips ref update for __root__ parent", async () => {
        const { context, written } = makeContext(null);
        await tool.execute(
            {
                title: "Top Level",
                content: "content",
                parents: ["__root__"]
            },
            context,
            { id: "tc1", name: "memory_node_write" }
        );
        // Only the node itself is written, no parent update for root.
        expect(written).toHaveLength(1);
    });
});
