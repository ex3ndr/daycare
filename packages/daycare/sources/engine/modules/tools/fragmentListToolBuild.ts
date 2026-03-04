import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";

import type { ToolDefinition, ToolResultContract } from "@/types";

const schema = Type.Object({}, { additionalProperties: false });

const fragmentListItemSchema = Type.Object(
    {
        id: Type.String(),
        kitVersion: Type.String(),
        title: Type.String(),
        description: Type.String(),
        version: Type.Number(),
        createdAt: Type.Number(),
        updatedAt: Type.Number()
    },
    { additionalProperties: false }
);

type FragmentListItem = {
    id: string;
    kitVersion: string;
    title: string;
    description: string;
    version: number;
    createdAt: number;
    updatedAt: number;
};

const resultSchema = Type.Object(
    {
        summary: Type.String(),
        fragments: Type.Array(fragmentListItemSchema)
    },
    { additionalProperties: false }
);

type FragmentListResult = {
    summary: string;
    fragments: FragmentListItem[];
};

const returns: ToolResultContract<FragmentListResult> = {
    schema: resultSchema,
    toLLMText: (result) => result.summary
};

/**
 * Builds the fragment_list tool for listing active non-archived fragments.
 * Expects: storage.fragments is available and scoped by ctx user.
 */
export function fragmentListToolBuild(): ToolDefinition<typeof schema, FragmentListResult> {
    return {
        tool: {
            name: "fragment_list",
            description: "List active fragments for the current user without returning full specs.",
            parameters: schema
        },
        returns,
        execute: async (_args, toolContext, toolCall) => {
            const storage = toolContext.storage ?? toolContext.agentSystem.storage;
            if (!storage) {
                throw new Error("Storage is not available.");
            }

            const fragments = await storage.fragments.findAll(toolContext.ctx);
            const summaryItems = fragments.map((fragment) => ({
                id: fragment.id,
                kitVersion: fragment.kitVersion,
                title: fragment.title,
                description: fragment.description,
                version: fragment.version ?? 1,
                createdAt: fragment.createdAt,
                updatedAt: fragment.updatedAt
            }));
            const summary = fragmentListSummaryBuild(summaryItems);
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
                typedResult: {
                    summary,
                    fragments: summaryItems
                }
            };
        }
    };
}

function fragmentListSummaryBuild(fragments: FragmentListItem[]): string {
    if (fragments.length === 0) {
        return "Found 0 fragments.";
    }

    const lines = [`Found ${fragments.length} fragments:`];
    for (const fragment of fragments) {
        lines.push(`- ${fragment.id}: ${fragment.title} (v${fragment.version}, kit ${fragment.kitVersion})`);
    }
    return lines.join("\n");
}
