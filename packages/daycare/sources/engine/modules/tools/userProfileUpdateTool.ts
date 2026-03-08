import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";

import type { ToolDefinition, ToolResultContract } from "@/types";
import type { UpdateUserInput } from "../../../storage/databaseTypes.js";
import { USER_CONFIGURATION_SYNC_EVENT } from "../../users/userConfigurationSyncEventBuild.js";

const schema = Type.Object(
    {
        firstName: Type.Optional(Type.String({ minLength: 1 })),
        lastName: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        country: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        timezone: Type.Optional(
            Type.Union([
                Type.String({ minLength: 1, description: "IANA timezone (for example America/New_York)." }),
                Type.Null()
            ])
        ),
        configuration: Type.Optional(
            Type.Object(
                {
                    homeReady: Type.Optional(Type.Boolean()),
                    appReady: Type.Optional(Type.Boolean()),
                    bootstrapStarted: Type.Optional(Type.Boolean())
                },
                { additionalProperties: false }
            )
        )
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
        timezone: Type.Union([Type.String(), Type.Null()]),
        configuration: Type.Object({
            homeReady: Type.Boolean(),
            appReady: Type.Boolean(),
            bootstrapStarted: Type.Boolean()
        }),
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
                "Update your user profile fields and app configuration: firstName, optional lastName, country, timezone, and configuration flags. Use null to clear optional fields.",
            parameters: schema
        },
        returns,
        visibleByDefault: (context) => context.config.foreground === true,
        execute: async (args, toolContext, toolCall) => {
            const payload = args as UserProfileUpdateArgs;
            const users = toolContext.agentSystem.storage.users;
            if (
                payload.firstName === undefined &&
                payload.lastName === undefined &&
                payload.country === undefined &&
                payload.timezone === undefined &&
                payload.configuration === undefined
            ) {
                throw new Error("At least one profile field must be provided.");
            }

            const updates: UpdateUserInput = {
                updatedAt: Date.now()
            };
            const changed: string[] = [];
            let configurationUpdated = false;

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
            if (payload.timezone !== undefined) {
                updates.timezone = timezoneOptionalNormalize(payload.timezone);
                changed.push("timezone");
            }
            if (payload.configuration !== undefined) {
                const current = await users.findById(toolContext.ctx.userId);
                if (!current) {
                    throw new Error(`User not found: ${toolContext.ctx.userId}`);
                }
                updates.configuration = configurationMerge(current.configuration, payload.configuration);
                changed.push("configuration");
                configurationUpdated = true;
            }

            await users.update(toolContext.ctx.userId, updates);

            const user = await users.findById(toolContext.ctx.userId);
            if (!user) {
                throw new Error(`User not found: ${toolContext.ctx.userId}`);
            }
            if (configurationUpdated) {
                toolContext.agentSystem.eventBus.emit(
                    USER_CONFIGURATION_SYNC_EVENT,
                    {
                        configuration: user.configuration
                    },
                    toolContext.ctx.userId
                );
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
                    timezone: user.timezone,
                    configuration: user.configuration,
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

function timezoneOptionalNormalize(value: string | null): string | null {
    if (value === null) {
        return null;
    }
    const normalized = value.trim();
    if (!normalized) {
        throw new Error("timezone must be a non-empty IANA timezone string or null.");
    }
    try {
        new Intl.DateTimeFormat("en-US", { timeZone: normalized });
        return normalized;
    } catch {
        throw new Error(`Invalid timezone: ${normalized}`);
    }
}

function configurationMerge(
    current: UserProfileUpdateResult["configuration"],
    configuration: NonNullable<UserProfileUpdateArgs["configuration"]>
) {
    return {
        ...current,
        ...configuration
    };
}
