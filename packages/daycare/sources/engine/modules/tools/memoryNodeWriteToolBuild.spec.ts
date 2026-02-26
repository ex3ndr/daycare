import { isCuid } from "@paralleldrive/cuid2";
import { describe, expect, it } from "vitest";
import { contextForAgent } from "../../agents/context.js";
import type { GraphNode } from "../../memory/graph/graphTypes.js";
import { memoryNodeWriteToolBuild } from "./memoryNodeWriteToolBuild.js";

function makeContext(existingNode: GraphNode | null) {
    const written: Array<{ node: GraphNode; options: { changeDescription?: string } | undefined }> = [];
    return {
        context: {
            memory: {
                readNode: async (_userId: string, _nodeId: string) => {
                    return existingNode;
                },
                writeNode: async (
                    _userId: string,
                    node: GraphNode,
                    options?: { changeDescription?: string }
                ): Promise<GraphNode> => {
                    const version = existingNode ? existingNode.frontmatter.version + 1 : 1;
                    const writtenNode: GraphNode = {
                        ...node,
                        frontmatter: {
                            ...node.frontmatter,
                            version
                        }
                    };
                    written.push({ node: writtenNode, options });
                    return writtenNode;
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
        expect(result.typedResult.version).toBe(1);
        expect(isCuid(result.typedResult.nodeId as string)).toBe(true);
        expect(written).toHaveLength(1);
        expect(written[0]!.node.frontmatter.title).toBe("User Preferences");
        expect(written[0]!.node.frontmatter.description).toBe("Stable user communication preferences");
        expect(written[0]!.node.frontmatter.parents).toEqual(["__root__"]);
        expect(written[0]!.node.content).toBe("Prefers dark mode.");
    });

    it("updates existing node and preserves createdAt", async () => {
        const existing: GraphNode = {
            id: "user-prefs",
            frontmatter: {
                title: "Old Title",
                description: "Old description",
                parents: ["__root__"],
                version: 1,
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
                parents: ["__root__"],
                changeDescription: "Updated preference wording"
            },
            context,
            { id: "tc1", name: "memory_node_write" }
        );
        expect(result.typedResult.summary).toContain("Updated");
        expect(result.typedResult.version).toBe(2);
        expect(written[0]!.node.frontmatter.createdAt).toBe(1000);
        expect(written[0]!.options?.changeDescription).toBe("Updated preference wording");
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
        expect(written[0]!.node.frontmatter.parents).toEqual(["__root__", "topic-a"]);
        expect(written[0]!.node.refs).toEqual(["ref-a"]);
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
        expect(written[0]!.node.frontmatter.parents).toEqual(["__root__", "topic-a"]);
    });

    it("requires changeDescription when updating existing node", async () => {
        const existing: GraphNode = {
            id: "node-1",
            frontmatter: {
                title: "Node",
                description: "Description",
                parents: ["__root__"],
                version: 2,
                createdAt: 1,
                updatedAt: 2
            },
            content: "Body",
            refs: []
        };
        const { context } = makeContext(existing);
        await expect(
            tool.execute(
                {
                    nodeId: "node-1",
                    title: "Node",
                    description: "Description",
                    content: "Updated body",
                    parents: ["__root__"]
                },
                context,
                { id: "tc1", name: "memory_node_write" }
            )
        ).rejects.toThrow("changeDescription is required");
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
