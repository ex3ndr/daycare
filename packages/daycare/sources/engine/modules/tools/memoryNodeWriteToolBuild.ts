import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { createId } from "@paralleldrive/cuid2";
import { type Static, Type } from "@sinclair/typebox";

import type { ToolDefinition, ToolResultContract } from "@/types";
import { GRAPH_ROOT_NODE_ID } from "../../memory/graph/graphTypes.js";

const schema = Type.Object(
    {
        nodeId: Type.Optional(Type.String({ minLength: 1 })),
        title: Type.String({ minLength: 1 }),
        description: Type.Optional(Type.String()),
        content: Type.String(),
        parents: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
        refs: Type.Optional(Type.Array(Type.String()))
    },
    { additionalProperties: false }
);

type MemoryNodeWriteArgs = Static<typeof schema>;

const resultSchema = Type.Object(
    {
        summary: Type.String(),
        nodeId: Type.String()
    },
    { additionalProperties: false }
);

type MemoryNodeWriteResult = { summary: string; nodeId: string };

const returns: ToolResultContract<MemoryNodeWriteResult> = {
    schema: resultSchema,
    toLLMText: (result) => result.summary
};

/**
 * Builds the memory_node_write tool that creates or updates a graph node.
 * When nodeId is omitted a cuid2 is generated. When provided the existing node is updated.
 * Root node (__root__) cannot be written — it is virtual and read-only.
 * Parents are required: the engine updates each parent's refs to include the new node.
 * Expects: toolContext.memory is available and ctx.userId identifies the user.
 */
export function memoryNodeWriteToolBuild(): ToolDefinition {
    return {
        tool: {
            name: "memory_node_write",
            description:
                "Create or update a memory document. Provide title, content (markdown body), parents (required list of parent node ids — use __root__ for top-level), and optional refs (child node ids). Omit nodeId to create; provide nodeId to update.",
            parameters: schema
        },
        returns,
        visibleByDefault: (context) => context.descriptor.type === "memory-agent",
        execute: async (args, toolContext, toolCall) => {
            const memory = toolContext.memory;
            if (!memory) {
                throw new Error("Memory is not available.");
            }

            const payload = args as MemoryNodeWriteArgs;
            const nodeId = payload.nodeId?.trim() || createId();
            if (nodeId.startsWith("__")) {
                throw new Error("Node ids starting with __ are reserved.");
            }

            const now = Date.now();
            const userId = toolContext.ctx.userId;
            const existing = await memory.readNode(userId, nodeId);

            await memory.writeNode(userId, {
                id: nodeId,
                frontmatter: {
                    title: payload.title.trim(),
                    description: payload.description?.trim() ?? "",
                    createdAt: existing?.frontmatter.createdAt ?? now,
                    updatedAt: now
                },
                content: payload.content,
                refs: payload.refs?.map((r) => r.trim()).filter((r) => r.length > 0) ?? []
            });

            // Update each non-root parent's refs to include this node.
            for (const parentId of payload.parents) {
                const trimmed = parentId.trim();
                if (trimmed === GRAPH_ROOT_NODE_ID) {
                    // Root is virtual — orphan nodes attach to root automatically via tree builder.
                    continue;
                }
                const parent = await memory.readNode(userId, trimmed);
                if (!parent) {
                    continue;
                }
                if (!parent.refs.includes(nodeId)) {
                    await memory.writeNode(userId, {
                        ...parent,
                        frontmatter: { ...parent.frontmatter, updatedAt: now },
                        refs: [...parent.refs, nodeId]
                    });
                }
            }

            const action = existing ? "Updated" : "Created";
            const summary = `${action} memory node: ${nodeId} ("${payload.title.trim()}")`;
            const toolMessage: ToolResultMessage = {
                role: "toolResult",
                toolCallId: toolCall.id,
                toolName: toolCall.name,
                content: [{ type: "text", text: summary }],
                isError: false,
                timestamp: Date.now()
            };

            return {
                toolMessage,
                typedResult: { summary, nodeId }
            };
        }
    };
}
