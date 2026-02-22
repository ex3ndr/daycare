import { describe, expect, it } from "vitest";

import type { GraphNode } from "../../memory/graph/graphTypes.js";
import { memoryNodeReadToolBuild } from "./memoryNodeReadToolBuild.js";

const sampleNode: GraphNode = {
    id: "user-prefs",
    frontmatter: {
        title: "User Preferences",
        description: "General user preferences",
        path: ["user"],
        createdAt: 1000,
        updatedAt: 2000
    },
    content: "Prefers dark mode and concise responses.",
    refs: ["person-alice"]
};

function makeContext(node: GraphNode | null) {
    return {
        memory: {
            readNode: async () => node
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

    it("throws when memory is not available", async () => {
        const ctx = { ctx: { agentId: "a", userId: "u" } } as never;
        await expect(tool.execute({ nodeId: "x" }, ctx, { id: "tc1", name: "memory_node_read" })).rejects.toThrow(
            "Memory is not available"
        );
    });
});
