import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";

import type { ToolDefinition, ToolResultContract } from "@/types";

const schema = Type.Object({}, { additionalProperties: false });

const resultSchema = Type.Object(
    {
        summary: Type.String()
    },
    { additionalProperties: false }
);

type MemoryGraphReadResult = { summary: string };

const returns: ToolResultContract<MemoryGraphReadResult> = {
    schema: resultSchema,
    toLLMText: (result) => result.summary
};

/**
 * Builds the memory_graph_read tool that returns the full graph tree overview.
 * Expects: toolContext.memory is available and ctx.userId identifies the user.
 */
export function memoryGraphReadToolBuild(): ToolDefinition {
    return {
        tool: {
            name: "memory_graph_read",
            description:
                "Read the full memory graph structure. Returns all nodes with their titles, paths, and content summaries.",
            parameters: schema
        },
        returns,
        execute: async (_args, toolContext, toolCall) => {
            const memory = toolContext.memory;
            if (!memory) {
                throw new Error("Memory is not available.");
            }

            const tree = await memory.readGraph(toolContext.ctx.userId);
            const lines: string[] = ["# Memory Graph", ""];

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

            if (lines.length === 2) {
                lines.push("(empty graph — no documents yet)");
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
                typedResult: { summary }
            };
        }
    };
}
