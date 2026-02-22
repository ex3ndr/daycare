import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";

import type { ToolDefinition, ToolResultContract } from "@/types";
import { GRAPH_ROOT_NODE_ID } from "../../memory/graph/graphTypes.js";

const schema = Type.Object(
    {
        nodeId: Type.Optional(Type.String({ minLength: 1 }))
    },
    { additionalProperties: false }
);

type MemoryNodeReadArgs = Static<typeof schema>;

const resultSchema = Type.Object(
    {
        found: Type.Boolean(),
        summary: Type.String()
    },
    { additionalProperties: false }
);

type MemoryNodeReadResult = { found: boolean; summary: string };

const returns: ToolResultContract<MemoryNodeReadResult> = {
    schema: resultSchema,
    toLLMText: (result) => result.summary
};

/**
 * Builds the memory_node_read tool that returns a single graph node by id.
 * When nodeId is omitted reads the root node with a full graph tree overview.
 * Expects: toolContext.memory is available and ctx.userId identifies the user.
 */
export function memoryNodeReadToolBuild(): ToolDefinition {
    return {
        tool: {
            name: "memory_node_read",
            description:
                "Read a memory document by node id. Omit nodeId to read the root node with a full graph tree overview. Returns content, frontmatter, and refs.",
            parameters: schema
        },
        returns,
        visibleByDefault: (context) => context.descriptor.type === "memory-agent",
        execute: async (args, toolContext, toolCall) => {
            const memory = toolContext.memory;
            if (!memory) {
                throw new Error("Memory is not available.");
            }

            const payload = args as MemoryNodeReadArgs;
            const nodeId = payload.nodeId?.trim() || GRAPH_ROOT_NODE_ID;

            const node = await memory.readNode(toolContext.ctx.userId, nodeId);
            if (!node) {
                const summary = `Node not found: ${nodeId}`;
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
                    typedResult: { found: false, summary }
                };
            }

            const isRoot = nodeId === GRAPH_ROOT_NODE_ID;
            const lines = [`# ${node.frontmatter.title}`, ""];
            if (!isRoot) {
                lines.push(`- **id**: \`${node.id}\``);
            }
            lines.push(
                `- **description**: ${node.frontmatter.description}`,
                `- **refs**: ${node.refs.length > 0 ? node.refs.map((r) => `\`${r}\``).join(", ") : "(none)"}`,
                "",
                node.content
            );

            // When reading root, append the full graph tree overview.
            if (nodeId === GRAPH_ROOT_NODE_ID) {
                const tree = await memory.readGraph(toolContext.ctx.userId);
                lines.push("", "## Children", "");

                const renderNode = (parentId: string, depth: number): void => {
                    const children = tree.children.get(parentId) ?? [];
                    for (const child of children) {
                        const indent = "  ".repeat(depth);
                        const contentPreview =
                            child.content.length > 200 ? `${child.content.slice(0, 200)}...` : child.content;
                        lines.push(`${indent}- **${child.frontmatter.title}** (id: \`${child.id}\`)`);
                        if (child.frontmatter.description) {
                            lines.push(`${indent}  ${child.frontmatter.description}`);
                        }
                        if (child.content.trim()) {
                            lines.push(`${indent}  > ${contentPreview.replace(/\n/g, " ")}`);
                        }
                        renderNode(child.id, depth + 1);
                    }
                };

                renderNode(tree.root.id, 0);

                if (!tree.children.has(tree.root.id) || tree.children.get(tree.root.id)!.length === 0) {
                    lines.push("(empty graph — no documents yet)");
                }
            }

            const summary = lines.join("\n");
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
                typedResult: { found: true, summary }
            };
        }
    };
}
