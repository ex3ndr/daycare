import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";

import type { ToolDefinition, ToolResultContract } from "@/types";
import type { UpdateUserInput } from "../../../storage/databaseTypes.js";

const schema = Type.Object(
    {
        firstName: Type.Optional(Type.String({ minLength: 1 })),
        lastName: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        country: Type.Optional(Type.Union([Type.String(), Type.Null()]))
    },
    { additionalProperties: false }
);

type UserProfileUpdateArgs = Static<typeof schema>;

const resultSchema = Type.Object(
    {
        summary: Type.String(),
        userId: Type.String(),
        firstName: Type.Union([Type.String(), Type.Null()]),
        lastName: Type.Union([Type.String(), Type.Null()]),
        country: Type.Union([Type.String(), Type.Null()]),
        nametag: Type.String()
    },
    { additionalProperties: false }
);

type UserProfileUpdateResult = Static<typeof resultSchema>;

const returns: ToolResultContract<UserProfileUpdateResult> = {
    schema: resultSchema,
    toLLMText: (result) => result.summary
};

/**
 * Updates structured profile fields for the current user scope.
 * Expects: caller is a foreground user agent and at least one field is provided.
 */
export function userProfileUpdateTool(): ToolDefinition {
    return {
        tool: {
            name: "user_profile_update",
            description:
                "Update your user profile fields: firstName, optional lastName, and country. Use null to clear lastName or country.",
            parameters: schema
        },
        returns,
        visibleByDefault: (context) => context.descriptor.type === "user",
        execute: async (args, toolContext, toolCall) => {
            const payload = args as UserProfileUpdateArgs;
            if (payload.firstName === undefined && payload.lastName === undefined && payload.country === undefined) {
                throw new Error("At least one profile field must be provided.");
            }

            const updates: UpdateUserInput = {
                updatedAt: Date.now()
            };
            const changed: string[] = [];

            if (payload.firstName !== undefined) {
                updates.firstName = valueRequiredNormalize(payload.firstName, "firstName");
                changed.push("firstName");
            }
            if (payload.lastName !== undefined) {
                updates.lastName = valueOptionalNormalize(payload.lastName, "lastName");
                changed.push("lastName");
            }
            if (payload.country !== undefined) {
                const country = valueOptionalNormalize(payload.country, "country");
                updates.country = country ? country.toUpperCase() : null;
                changed.push("country");
            }

            const users = toolContext.agentSystem.storage.users;
            await users.update(toolContext.ctx.userId, updates);

            const user = await users.findById(toolContext.ctx.userId);
            if (!user) {
                throw new Error(`User not found: ${toolContext.ctx.userId}`);
            }

            const summary = `Updated ${changed.join(", ")} for @${user.nametag}.`;
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
                    userId: user.id,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    country: user.country,
                    nametag: user.nametag
                }
            };
        }
    };
}

function valueRequiredNormalize(value: string, field: string): string {
    const normalized = value.trim();
    if (!normalized) {
        throw new Error(`${field} must be a non-empty string.`);
    }
    return normalized;
}

function valueOptionalNormalize(value: string | null, field: string): string | null {
    if (value === null) {
        return null;
    }
    const normalized = value.trim();
    if (!normalized) {
        throw new Error(`${field} must be a non-empty string or null.`);
    }
    return normalized;
}
