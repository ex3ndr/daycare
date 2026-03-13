import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";

import type { ToolDefinition, ToolResultContract } from "@/types";
import { timezoneIsValid } from "../../../utils/timezoneIsValid.js";

const schema = Type.Object({}, { additionalProperties: false });

const resultSchema = Type.Object(
    {
        summary: Type.String(),
        unixTimeMs: Type.Integer(),
        unixTimeSeconds: Type.Integer(),
        isoTimeUtc: Type.String(),
        timezone: Type.String(),
        timezoneAbbr: Type.String(),
        timezoneSource: Type.Union([Type.Literal("profile"), Type.Literal("default")]),
        localDate: Type.String(),
        localTime: Type.String(),
        localDateTime: Type.String()
    },
    { additionalProperties: false }
);

type NowResult = Static<typeof resultSchema>;

const returns: ToolResultContract<NowResult> = {
    schema: resultSchema,
    toLLMText: (result) => result.summary
};

/**
 * Returns structured current time using the caller's profile timezone when available.
 * Expects: invalid or missing profile timezones fall back to UTC.
 */
export function nowTool(): ToolDefinition {
    return {
        tool: {
            name: "now",
            description:
                "Return structured current time with unix timestamps, UTC ISO time, and localized time from the user's profile timezone.",
            parameters: schema
        },
        returns,
        execute: async (_args, toolContext, toolCall) => {
            const user = await toolContext.agentSystem.storage.users.findById(toolContext.ctx.userId);
            const profileTimezone = user?.timezone?.trim() ?? "";
            const timezone = profileTimezone && timezoneIsValid(profileTimezone) ? profileTimezone : "UTC";
            const timezoneSource = timezone === profileTimezone ? "profile" : "default";
            const nowAt = Date.now();
            const date = new Date(nowAt);
            const localParts = localDateTimePartsResolve(date, timezone);
            const timezoneAbbr = timezoneAbbreviationResolve(date, timezone);
            const localDate = `${localParts.year}-${localParts.month}-${localParts.day}`;
            const localTime = `${localParts.hour}:${localParts.minute}:${localParts.second}`;
            const localDateTime = `${localDate} ${localTime}`;
            const summary = `Current time: ${localDateTime} (${timezoneAbbr || timezone}, ${timezone}); unix=${nowAt}.`;

            const typedResult: NowResult = {
                summary,
                unixTimeMs: nowAt,
                unixTimeSeconds: Math.floor(nowAt / 1000),
                isoTimeUtc: date.toISOString(),
                timezone,
                timezoneAbbr,
                timezoneSource,
                localDate,
                localTime,
                localDateTime
            };

            const toolMessage: ToolResultMessage = {
                role: "toolResult",
                toolCallId: toolCall.id,
                toolName: toolCall.name,
                content: [{ type: "text", text: summary }],
                isError: false,
                timestamp: nowAt
            };

            return {
                toolMessage,
                typedResult
            };
        }
    };
}

function localDateTimePartsResolve(
    date: Date,
    timezone: string
): Record<"year" | "month" | "day" | "hour" | "minute" | "second", string> {
    const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
    });
    const parts = formatter.formatToParts(date);
    return {
        year: dateTimePartResolve(parts, "year"),
        month: dateTimePartResolve(parts, "month"),
        day: dateTimePartResolve(parts, "day"),
        hour: dateTimePartResolve(parts, "hour"),
        minute: dateTimePartResolve(parts, "minute"),
        second: dateTimePartResolve(parts, "second")
    };
}

function dateTimePartResolve(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
    return parts.find((part) => part.type === type)?.value ?? "";
}

function timezoneAbbreviationResolve(date: Date, timezone: string): string {
    const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        timeZoneName: "short"
    });
    return formatter.formatToParts(date).find((part) => part.type === "timeZoneName")?.value ?? timezone;
}
