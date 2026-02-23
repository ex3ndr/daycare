import { isCuid } from "@paralleldrive/cuid2";
import { describe, expect, it } from "vitest";
import { contextForAgent } from "../../agents/context.js";
import type { GraphNode } from "../../memory/graph/graphTypes.js";
import { memoryNodeWriteToolBuild } from "./memoryNodeWriteToolBuild.js";

function makeContext(existingNode: GraphNode | null) {
    const written: GraphNode[] = [];
    return {
        context: {
            memory: {
                readNode: async (_userId: string, _nodeId: string) => {
                    return existingNode;
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

    it("is visible by default only for memory-agent descriptors", () => {
        expect(
            tool.visibleByDefault?.({
                ctx: contextForAgent({ userId: "user-1", agentId: "agent-1" }),
                descriptor: { type: "memory-agent", id: "source-agent-1" }
            })
        ).toBe(true);
        expect(
            tool.visibleByDefault?.({
                ctx: contextForAgent({ userId: "user-1", agentId: "agent-1" }),
                descriptor: { type: "user", connector: "telegram", userId: "user-1", channelId: "channel-1" }
            })
        ).toBe(false);
    });

    it("generates cuid2 id when nodeId is omitted", async () => {
        const { context, written } = makeContext(null);
        const result = await tool.execute(
            {
                title: "User Preferences",
                description: "Stable user communication preferences",
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
        expect(written[0]!.frontmatter.description).toBe("Stable user communication preferences");
        expect(written[0]!.frontmatter.parents).toEqual(["__root__"]);
        expect(written[0]!.content).toBe("Prefers dark mode.");
    });

    it("updates existing node and preserves createdAt", async () => {
        const existing: GraphNode = {
            id: "user-prefs",
            frontmatter: {
                title: "Old Title",
                description: "Old description",
                parents: ["__root__"],
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
                description: "Current preferences and communication style",
                content: "Updated content.",
                parents: ["__root__"]
            },
            context,
            { id: "tc1", name: "memory_node_write" }
        );
        expect(result.typedResult.summary).toContain("Updated");
        expect(written[0]!.frontmatter.createdAt).toBe(1000);
    });

    it("normalizes parents and refs by trimming, deduping, and removing self references", async () => {
        const { context, written } = makeContext(null);
        await tool.execute(
            {
                nodeId: "node-1",
                title: "Node",
                description: "A fully normalized memory node",
                content: "Body",
                parents: ["__root__", " topic-a ", "topic-a", "node-1", "   "],
                refs: [" ref-a ", "ref-a", "node-1", " "]
            },
            context,
            { id: "tc1", name: "memory_node_write" }
        );

        expect(written).toHaveLength(1);
        expect(written[0]!.frontmatter.parents).toEqual(["__root__", "topic-a"]);
        expect(written[0]!.refs).toEqual(["ref-a"]);
    });

    it("normalizes parent root alias to __root__", async () => {
        const { context, written } = makeContext(null);
        await tool.execute(
            {
                nodeId: "node-1",
                title: "Node",
                description: "A fully normalized memory node",
                content: "Body",
                parents: ["root", "topic-a"],
                refs: []
            },
            context,
            { id: "tc1", name: "memory_node_write" }
        );

        expect(written).toHaveLength(1);
        expect(written[0]!.frontmatter.parents).toEqual(["__root__", "topic-a"]);
    });

    it("rejects reserved node ids", async () => {
        const { context } = makeContext(null);
        await expect(
            tool.execute(
                {
                    nodeId: "__root__",
                    title: "Root",
                    description: "Root",
                    content: "x",
                    parents: ["__root__"]
                },
                context,
                {
                    id: "tc1",
                    name: "memory_node_write"
                }
            )
        ).rejects.toThrow("reserved");
    });

    it("rejects empty description", async () => {
        const { context } = makeContext(null);
        await expect(
            tool.execute(
                {
                    title: "Node",
                    description: " ",
                    content: "x",
                    parents: ["__root__"]
                },
                context,
                { id: "tc1", name: "memory_node_write" }
            )
        ).rejects.toThrow("description is required");
    });

    it("rejects missing parents", async () => {
        const { context } = makeContext(null);
        await expect(
            tool.execute(
                {
                    title: "Node",
                    description: "Node description",
                    content: "x"
                } as never,
                context,
                { id: "tc1", name: "memory_node_write" }
            )
        ).rejects.toThrow("parents are required");
    });

    it("rejects parents that normalize to empty", async () => {
        const { context } = makeContext(null);
        await expect(
            tool.execute(
                {
                    title: "Node",
                    description: "Node description",
                    content: "x",
                    parents: [" "]
                },
                context,
                { id: "tc1", name: "memory_node_write" }
            )
        ).rejects.toThrow("parents must include at least one valid parent id");
    });

    it("rejects reserved parent ids other than __root__", async () => {
        const { context } = makeContext(null);
        await expect(
            tool.execute(
                {
                    title: "Node",
                    description: "Node description",
                    content: "x",
                    parents: ["__internal"]
                },
                context,
                { id: "tc1", name: "memory_node_write" }
            )
        ).rejects.toThrow("Only __root__ is allowed as a reserved parent id");
    });

    it("throws when memory is not available", async () => {
        const ctx = { ctx: { agentId: "a", userId: "u" } } as never;
        await expect(
            tool.execute(
                {
                    title: "T",
                    description: "T description",
                    content: "c",
                    parents: ["__root__"]
                },
                ctx,
                {
                    id: "tc1",
                    name: "memory_node_write"
                }
            )
        ).rejects.toThrow("Memory is not available");
    });
});
