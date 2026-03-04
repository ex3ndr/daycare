import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";

import type { ToolDefinition, ToolResultContract, ToolResultValue } from "@/types";
import type { FragmentDbRecord } from "../../../storage/databaseTypes.js";

const schema = Type.Object(
    {
        fragmentId: Type.String({ minLength: 1 })
    },
    { additionalProperties: false }
);

type FragmentReadArgs = Static<typeof schema>;

const fragmentSchema = Type.Object(
    {
        id: Type.String(),
        kitVersion: Type.String(),
        title: Type.String(),
        description: Type.String(),
        spec: Type.Any(),
        archived: Type.Boolean(),
        version: Type.Number(),
        createdAt: Type.Number(),
        updatedAt: Type.Number()
    },
    { additionalProperties: false }
);

type FragmentReadItem = {
    id: string;
    kitVersion: string;
    title: string;
    description: string;
    spec: Record<string, ToolResultValue>;
    archived: boolean;
    version: number;
    createdAt: number;
    updatedAt: number;
};

const resultSchema = Type.Object(
    {
        summary: Type.String(),
        fragment: Type.Union([fragmentSchema, Type.Null()])
    },
    { additionalProperties: false }
);

type FragmentReadResult = {
    summary: string;
    fragment: FragmentReadItem | null;
};

const returns: ToolResultContract<FragmentReadResult> = {
    schema: resultSchema,
    toLLMText: (result) => fragmentReadTextBuild(result)
};

/**
 * Builds the fragment_read tool for reading an existing fragment by id.
 * Expects: fragmentId is provided and storage.fragments is available.
 */
export function fragmentReadToolBuild(): ToolDefinition<typeof schema, FragmentReadResult> {
    return {
        tool: {
            name: "fragment_read",
            description: "Read a fragment by id, including archived fragments, with full spec details.",
            parameters: schema
        },
        returns,
        execute: async (args, toolContext, toolCall) => {
            const storage = toolContext.storage ?? toolContext.agentSystem.storage;
            if (!storage) {
                throw new Error("Storage is not available.");
            }

            const payload = args as FragmentReadArgs;
            const fragmentId = typeof payload.fragmentId === "string" ? payload.fragmentId.trim() : "";
            if (!fragmentId) {
                throw new Error("fragmentId is required.");
            }

            const fragment = await storage.fragments.findAnyById(toolContext.ctx, fragmentId);
            const typedResult = fragmentReadResultBuild(fragmentId, fragment);
            const text = returns.toLLMText(typedResult);
            const toolMessage: ToolResultMessage = {
                role: "toolResult",
                toolCallId: toolCall.id,
                toolName: toolCall.name,
                content: [{ type: "text", text }],
                isError: false,
                timestamp: Date.now()
            };

            return {
                toolMessage,
                typedResult
            };
        }
    };
}

function fragmentReadResultBuild(fragmentId: string, fragment: FragmentDbRecord | null): FragmentReadResult {
    if (!fragment) {
        return {
            summary: `Fragment not found: ${fragmentId}.`,
            fragment: null
        };
    }

    return {
        summary: `Fragment ${fragment.id} (version ${fragment.version ?? 1}, kitVersion ${fragment.kitVersion}).`,
        fragment: {
            id: fragment.id,
            kitVersion: fragment.kitVersion,
            title: fragment.title,
            description: fragment.description,
            spec: fragmentReadSpecNormalize(fragment.spec),
            archived: fragment.archived,
            version: fragment.version ?? 1,
            createdAt: fragment.createdAt,
            updatedAt: fragment.updatedAt
        }
    };
}

function fragmentReadSpecNormalize(spec: unknown): Record<string, ToolResultValue> {
    if (!spec || typeof spec !== "object" || Array.isArray(spec)) {
        return {};
    }
    return spec as Record<string, ToolResultValue>;
}

function fragmentReadTextBuild(result: FragmentReadResult): string {
    if (!result.fragment) {
        return result.summary;
    }

    const specText = JSON.stringify(result.fragment.spec, null, 2);
    return [
        result.summary,
        "",
        `id: ${result.fragment.id}`,
        `title: ${result.fragment.title}`,
        `description: ${result.fragment.description || "(none)"}`,
        `archived: ${result.fragment.archived}`,
        `createdAt: ${result.fragment.createdAt}`,
        `updatedAt: ${result.fragment.updatedAt}`,
        "",
        "spec:",
        "```json",
        specText,
        "```"
    ].join("\n");
}
