import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { createId } from "@paralleldrive/cuid2";
import { type Static, Type } from "@sinclair/typebox";

import type { ToolDefinition, ToolResultContract } from "@/types";
import { GRAPH_ROOT_NODE_ID } from "../../memory/graph/graphTypes.js";

const schema = Type.Object(
    {
        nodeId: Type.Optional(Type.String({ minLength: 1 })),
        title: Type.String({ minLength: 1 }),
        description: Type.String({ minLength: 1 }),
        content: Type.String(),
        parents: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
        refs: Type.Optional(Type.Array(Type.String({ minLength: 1 })))
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
 * Title, description, and parents are required and normalized before writing.
 * Expects: toolContext.memory is available and ctx.userId identifies the user.
 */
export function memoryNodeWriteToolBuild(): ToolDefinition {
    return {
        tool: {
            name: "memory_node_write",
            description:
                "Create or update a memory document. Provide title, description, content (markdown body), parents (required list of parent node ids — use __root__ or root for top-level), and optional refs (cross-reference node ids). Omit nodeId to create; provide nodeId to update.",
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

            const title = payload.title.trim();
            if (title.length === 0) {
                throw new Error("Memory node title is required.");
            }
            const description = payload.description.trim();
            if (description.length === 0) {
                throw new Error("Memory node description is required.");
            }

            const rawParents = Array.isArray(payload.parents) ? payload.parents : [];
            if (rawParents.length === 0) {
                throw new Error("Memory node parents are required and must include at least one parent id.");
            }
            const parents = memoryNodeIdsNormalize(rawParents, [nodeId], { normalizeRootAlias: true });
            if (parents.length === 0) {
                throw new Error("Memory node parents must include at least one valid parent id.");
            }
            for (const parentId of parents) {
                if (parentId.startsWith("__") && parentId !== GRAPH_ROOT_NODE_ID) {
                    throw new Error("Only __root__ is allowed as a reserved parent id.");
                }
            }
            const refs = memoryNodeIdsNormalize(payload.refs ?? [], [nodeId], { normalizeRootAlias: false });

            const now = Date.now();
            const userId = toolContext.ctx.userId;
            const existing = await memory.readNode(userId, nodeId);

            await memory.writeNode(userId, {
                id: nodeId,
                frontmatter: {
                    title,
                    description,
                    parents,
                    createdAt: existing?.frontmatter.createdAt ?? now,
                    updatedAt: now
                },
                content: payload.content,
                refs
            });

            const action = existing ? "Updated" : "Created";
            const summary = `${action} memory node: ${nodeId} ("${title}")`;
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

function memoryNodeIdsNormalize(
    values: string[],
    excludedIds: string[],
    options: { normalizeRootAlias: boolean }
): string[] {
    const excluded = new Set(excludedIds);
    const seen = new Set<string>();
    const normalized: string[] = [];
    for (const value of values) {
        const trimmed = value.trim();
        const nodeId = options.normalizeRootAlias && trimmed.toLowerCase() === "root" ? GRAPH_ROOT_NODE_ID : trimmed;
        if (nodeId.length === 0 || excluded.has(nodeId) || seen.has(nodeId)) {
            continue;
        }
        seen.add(nodeId);
        normalized.push(nodeId);
    }
    return normalized;
}
