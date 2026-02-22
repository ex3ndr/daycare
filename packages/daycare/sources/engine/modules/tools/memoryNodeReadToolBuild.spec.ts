import { describe, expect, it } from "vitest";

import type { GraphNode, GraphTree } from "../../memory/graph/graphTypes.js";
import { memoryNodeReadToolBuild } from "./memoryNodeReadToolBuild.js";

const sampleNode: GraphNode = {
    id: "user-prefs",
    frontmatter: {
        title: "User Preferences",
        description: "General user preferences",
        createdAt: 1000,
        updatedAt: 2000
    },
    content: "Prefers dark mode and concise responses.",
    refs: ["person-alice"]
};

const rootNode: GraphNode = {
    id: "__root__",
    frontmatter: {
        title: "Memory Summary",
        description: "Structured summary of all memories",
        createdAt: 0,
        updatedAt: 0
    },
    content: "# Memory Graph\nRoot content.",
    refs: ["user-prefs"]
};

function makeContext(node: GraphNode | null, tree?: GraphTree) {
    const defaultTree: GraphTree = {
        root: rootNode,
        children: new Map<string, GraphNode[]>([["__root__", []]])
    };
    return {
        memory: {
            readNode: async (_userId: string, nodeId: string) => {
                if (nodeId === "__root__")
                    return {
                        ...rootNode,
                        refs: (tree ?? defaultTree).children.get("__root__")?.map((c) => c.id) ?? []
                    };
                return node;
            },
            readGraph: async () => tree ?? defaultTree
        },
        ctx: { agentId: "agent-1", userId: "user-1" }
    } as never;
}

describe("memoryNodeReadToolBuild", () => {
    const tool = memoryNodeReadToolBuild();

    it("is visible by default only for memory-agent descriptors", () => {
        expect(
            tool.visibleByDefault?.({
                userId: "user-1",
                agentId: "agent-1",
                descriptor: { type: "memory-agent", id: "source-agent-1" }
            })
        ).toBe(true);
        expect(
            tool.visibleByDefault?.({
                userId: "user-1",
                agentId: "agent-1",
                descriptor: { type: "user", connector: "telegram", userId: "user-1", channelId: "channel-1" }
            })
        ).toBe(false);
    });

    it("returns node content with id when found", async () => {
        const result = await tool.execute({ nodeId: "user-prefs" }, makeContext(sampleNode), {
            id: "tc1",
            name: "memory_node_read"
        });
        expect(result.typedResult.found).toBe(true);
        expect(result.typedResult.summary).toContain("User Preferences");
        expect(result.typedResult.summary).toContain("Prefers dark mode");
        expect(result.typedResult.summary).toContain("person-alice");
        expect(result.typedResult.summary).toContain("**id**: `user-prefs`");
    });

    it("returns not found when node is missing", async () => {
        const result = await tool.execute({ nodeId: "nonexistent" }, makeContext(null), {
            id: "tc1",
            name: "memory_node_read"
        });
        expect(result.typedResult.found).toBe(false);
        expect(result.typedResult.summary).toContain("not found");
    });

    it("reads root without id but with children refs and tree overview", async () => {
        const tree: GraphTree = {
            root: rootNode,
            children: new Map([["__root__", [sampleNode]]])
        };
        const result = await tool.execute({}, makeContext(null, tree), {
            id: "tc1",
            name: "memory_node_read"
        });
        expect(result.typedResult.found).toBe(true);
        expect(result.typedResult.summary).toContain("Memory Summary");
        expect(result.typedResult.summary).not.toContain("**id**: `__root__`");
        expect(result.typedResult.summary).toContain("Children");
        expect(result.typedResult.summary).toContain("User Preferences");
        expect(result.typedResult.summary).toContain("user-prefs");
        expect(result.typedResult.summary).toContain("**refs**");
    });

    it("shows empty graph message when root has no children", async () => {
        const result = await tool.execute({}, makeContext(null), {
            id: "tc1",
            name: "memory_node_read"
        });
        expect(result.typedResult.found).toBe(true);
        expect(result.typedResult.summary).toContain("empty graph");
    });

    it("throws when memory is not available", async () => {
        const ctx = { ctx: { agentId: "a", userId: "u" } } as never;
        await expect(tool.execute({ nodeId: "x" }, ctx, { id: "tc1", name: "memory_node_read" })).rejects.toThrow(
            "Memory is not available"
        );
    });
});
