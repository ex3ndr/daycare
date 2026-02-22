import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";

import type { ToolDefinition, ToolResultContract } from "@/types";

const schema = Type.Object(
    {
        nodeId: Type.String({ minLength: 1 }),
        title: Type.String({ minLength: 1 }),
        description: Type.Optional(Type.String()),
        content: Type.String(),
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
 * Expects: toolContext.memory is available and ctx.userId identifies the user.
 */
export function memoryNodeWriteToolBuild(): ToolDefinition {
    return {
        tool: {
            name: "memory_node_write",
            description:
                "Create or update a memory document. Provide nodeId, title, content (markdown body), and optional refs (ids of related nodes as children). Overwrites existing node if nodeId matches.",
            parameters: schema
        },
        returns,
        execute: async (args, toolContext, toolCall) => {
            const memory = toolContext.memory;
            if (!memory) {
                throw new Error("Memory is not available.");
            }

            const payload = args as MemoryNodeWriteArgs;
            const nodeId = payload.nodeId.trim();
            if (!nodeId) {
                throw new Error("nodeId is required.");
            }
            if (nodeId.startsWith("__")) {
                throw new Error("Node ids starting with __ are reserved.");
            }

            const now = Date.now();
            const existing = await memory.readNode(toolContext.ctx.userId, nodeId);

            await memory.writeNode(toolContext.ctx.userId, {
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
