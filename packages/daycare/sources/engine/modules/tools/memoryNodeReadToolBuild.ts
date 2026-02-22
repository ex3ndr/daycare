import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";

import type { ToolDefinition, ToolResultContract } from "@/types";

const schema = Type.Object(
    {
        nodeId: Type.String({ minLength: 1 })
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
 * Expects: toolContext.memory is available and ctx.userId identifies the user.
 */
export function memoryNodeReadToolBuild(): ToolDefinition {
    return {
        tool: {
            name: "memory_node_read",
            description:
                "Read a single memory document by node id. Returns the full content, frontmatter (title, description), and refs.",
            parameters: schema
        },
        returns,
        execute: async (args, toolContext, toolCall) => {
            const memory = toolContext.memory;
            if (!memory) {
                throw new Error("Memory is not available.");
            }

            const payload = args as MemoryNodeReadArgs;
            const nodeId = payload.nodeId.trim();
            if (!nodeId) {
                throw new Error("nodeId is required.");
            }

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

            const lines = [
                `# ${node.frontmatter.title}`,
                "",
                `- **id**: \`${node.id}\``,
                `- **description**: ${node.frontmatter.description}`,
                `- **refs**: ${node.refs.length > 0 ? node.refs.map((r) => `\`${r}\``).join(", ") : "(none)"}`,
                "",
                node.content
            ];

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
