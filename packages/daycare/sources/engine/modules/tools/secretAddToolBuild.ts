import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";
import type { ToolDefinition, ToolResultContract } from "@/types";

const schema = Type.Object(
    {
        name: Type.String({ minLength: 1 }),
        displayName: Type.String({ minLength: 1 }),
        description: Type.String({ minLength: 1 }),
        variables: Type.Record(
            Type.String({ minLength: 1 }),
            Type.Union([Type.String(), Type.Number(), Type.Boolean()]),
            { minProperties: 1 }
        )
    },
    { additionalProperties: false }
);

type SecretAddArgs = Static<typeof schema>;

const resultSchema = Type.Object(
    {
        summary: Type.String(),
        name: Type.String(),
        status: Type.String(),
        variableNames: Type.Array(Type.String())
    },
    { additionalProperties: false }
);

type SecretAddResult = {
    summary: string;
    name: string;
    status: "created" | "updated";
    variableNames: string[];
};

const returns: ToolResultContract<SecretAddResult> = {
    schema: resultSchema,
    toLLMText: (result) => result.summary
};

/**
 * Creates or updates a named secret with environment variables.
 * Expects: variables contains non-empty keys; values are serialized to strings.
 */
export function secretAddToolBuild(): ToolDefinition {
    return {
        tool: {
            name: "secret_add",
            description:
                "Create or update a named secret. Secrets store environment variable mappings and can be reused in exec calls.",
            parameters: schema
        },
        returns,
        execute: async (args, toolContext, toolCall) => {
            const payload = args as SecretAddArgs;
            if (!toolContext.secrets) {
                throw new Error("Secrets service is not configured.");
            }

            const name = payload.name.trim();
            const displayName = payload.displayName.trim();
            const description = payload.description.trim();
            if (!name || !displayName || !description) {
                throw new Error("name, displayName, and description are required.");
            }

            const variables = secretVariablesNormalize(payload.variables);
            const variableNames = Object.keys(variables).sort((left, right) => left.localeCompare(right));
            if (variableNames.length === 0) {
                throw new Error("At least one variable is required.");
            }

            const existing = await toolContext.secrets.list(toolContext.ctx);
            const status: SecretAddResult["status"] = existing.some((entry) => entry.name === name)
                ? "updated"
                : "created";

            await toolContext.secrets.add(toolContext.ctx, {
                name,
                displayName,
                description,
                variables
            });

            const summary = `Secret "${name}" ${status}. Variables: ${variableNames.join(", ")}.`;
            const toolMessage: ToolResultMessage = {
                role: "toolResult",
                toolCallId: toolCall.id,
                toolName: toolCall.name,
                content: [{ type: "text", text: summary }],
                isError: false,
                timestamp: Date.now()
            };
            const typedResult: SecretAddResult = {
                summary,
                name,
                status,
                variableNames
            };
            return {
                toolMessage,
                typedResult
            };
        }
    };
}

function secretVariablesNormalize(input: Record<string, string | number | boolean>): Record<string, string> {
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(input)) {
        const normalizedKey = key.trim();
        if (!normalizedKey) {
            throw new Error("Variable names must be non-empty.");
        }
        normalized[normalizedKey] = typeof value === "string" ? value : String(value);
    }
    return normalized;
}
