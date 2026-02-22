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
    refs: []
};

function makeContext(node: GraphNode | null, tree?: GraphTree) {
    return {
        memory: {
            readNode: async (_userId: string, nodeId: string) => {
                if (nodeId === "__root__") return rootNode;
                return node;
            },
            readGraph: async () =>
                tree ?? {
                    root: rootNode,
                    children: new Map<string, GraphNode[]>([["__root__", []]])
                }
        },
        ctx: { agentId: "agent-1", userId: "user-1" }
    } as never;
}

describe("memoryNodeReadToolBuild", () => {
    const tool = memoryNodeReadToolBuild();

    it("returns node content when found", async () => {
        const result = await tool.execute({ nodeId: "user-prefs" }, makeContext(sampleNode), {
            id: "tc1",
            name: "memory_node_read"
        });
        expect(result.typedResult.found).toBe(true);
        expect(result.typedResult.summary).toContain("User Preferences");
        expect(result.typedResult.summary).toContain("Prefers dark mode");
        expect(result.typedResult.summary).toContain("person-alice");
    });

    it("returns not found when node is missing", async () => {
        const result = await tool.execute({ nodeId: "nonexistent" }, makeContext(null), {
            id: "tc1",
            name: "memory_node_read"
        });
        expect(result.typedResult.found).toBe(false);
        expect(result.typedResult.summary).toContain("not found");
    });

    it("reads root with tree overview when nodeId is omitted", async () => {
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
        expect(result.typedResult.summary).toContain("Children");
        expect(result.typedResult.summary).toContain("User Preferences");
        expect(result.typedResult.summary).toContain("user-prefs");
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
