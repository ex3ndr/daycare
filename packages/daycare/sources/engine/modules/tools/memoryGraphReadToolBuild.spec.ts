import { describe, expect, it } from "vitest";

import type { GraphNode, GraphTree } from "../../memory/graph/graphTypes.js";
import { memoryGraphReadToolBuild } from "./memoryGraphReadToolBuild.js";

function makeTree(children: GraphNode[]): GraphTree {
    const root: GraphNode = {
        id: "__root__",
        frontmatter: { title: "Root", description: "", path: [], createdAt: 0, updatedAt: 0 },
        content: "",
        refs: []
    };
    const childMap = new Map<string, GraphNode[]>();
    childMap.set(root.id, children);
    return { root, children: childMap };
}

function makeContext(tree: GraphTree) {
    return {
        memory: {
            readGraph: async () => tree
        },
        ctx: { agentId: "agent-1", userId: "user-1" }
    } as never;
}

describe("memoryGraphReadToolBuild", () => {
    const tool = memoryGraphReadToolBuild();

    it("returns empty graph message when no children", async () => {
        const tree = makeTree([]);
        const result = await tool.execute({}, makeContext(tree), { id: "tc1", name: "memory_graph_read" });
        expect(result.typedResult.summary).toContain("empty graph");
        expect(result.toolMessage.isError).toBe(false);
    });

    it("lists nodes with titles and ids", async () => {
        const node: GraphNode = {
            id: "user-prefs",
            frontmatter: {
                title: "User Preferences",
                description: "General prefs",
                path: [],
                createdAt: 0,
                updatedAt: 0
            },
            content: "Prefers dark mode",
            refs: []
        };
        const tree = makeTree([node]);
        const result = await tool.execute({}, makeContext(tree), { id: "tc1", name: "memory_graph_read" });
        expect(result.typedResult.summary).toContain("User Preferences");
        expect(result.typedResult.summary).toContain("user-prefs");
        expect(result.typedResult.summary).toContain("Prefers dark mode");
    });

    it("throws when memory is not available", async () => {
        const ctx = { ctx: { agentId: "a", userId: "u" } } as never;
        await expect(tool.execute({}, ctx, { id: "tc1", name: "memory_graph_read" })).rejects.toThrow(
            "Memory is not available"
        );
    });
});
