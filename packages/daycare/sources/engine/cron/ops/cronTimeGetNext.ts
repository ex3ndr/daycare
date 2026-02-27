import { cronExpressionParse } from "./cronExpressionParse.js";
import { cronFieldMatch } from "./cronFieldMatch.js";

/**
 * Calculates the next time a cron expression should run.
 *
 * Expects: a valid cron expression string and optional start date.
 * Returns: the next matching Date, or null if invalid/no match within 2 years.
 */
export function cronTimeGetNext(expression: string, from?: Date, timezone?: string): Date | null {
    const parsed = cronExpressionParse(expression);
    if (!parsed) {
        return null;
    }

    const start = from?.getTime() ?? Date.now();
    let candidateMs = Math.floor(start / 60_000) * 60_000 + 60_000;
    const normalizedTimezone = timezone?.trim() ?? "";
    const formatter = timezoneFormatterBuild(normalizedTimezone);
    if (normalizedTimezone && !formatter) {
        return null;
    }

    // Search for next matching time (max 2 years to prevent infinite loop)
    const maxIterations = 365 * 24 * 60 * 2;

    for (let i = 0; i < maxIterations; i++) {
        const candidate = new Date(candidateMs);
        const parts = formatter ? datePartsInTimezone(candidate, formatter) : datePartsInLocalTimezone(candidate);

        if (
            cronFieldMatch(parsed.month, parts.month) &&
            cronFieldMatch(parsed.day, parts.day) &&
            cronFieldMatch(parsed.weekday, parts.weekday) &&
            cronFieldMatch(parsed.hour, parts.hour) &&
            cronFieldMatch(parsed.minute, parts.minute)
        ) {
            return candidate;
        }

        candidateMs += 60_000;
    }

    return null;
}

type CronDateParts = {
    month: number;
    day: number;
    weekday: number;
    hour: number;
    minute: number;
};

const WEEKDAY_TO_INDEX: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6
};

function datePartsInLocalTimezone(date: Date): CronDateParts {
    return {
        month: date.getMonth() + 1,
        day: date.getDate(),
        weekday: date.getDay(),
        hour: date.getHours(),
        minute: date.getMinutes()
    };
}

function timezoneFormatterBuild(timezone: string): Intl.DateTimeFormat | null {
    if (!timezone) {
        return null;
    }
    try {
        return new Intl.DateTimeFormat("en-US", {
            timeZone: timezone,
            weekday: "short",
            month: "numeric",
            day: "numeric",
            hour: "numeric",
            minute: "numeric",
            hour12: false
        });
    } catch {
        return null;
    }
}

function datePartsInTimezone(date: Date, formatter: Intl.DateTimeFormat): CronDateParts {
    const parts = formatter.formatToParts(date);
    const month = Number(parts.find((part) => part.type === "month")?.value ?? "0");
    const day = Number(parts.find((part) => part.type === "day")?.value ?? "0");
    const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0") % 24;
    const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
    const weekdayName = parts.find((part) => part.type === "weekday")?.value ?? "";
    const weekday = WEEKDAY_TO_INDEX[weekdayName] ?? -1;

    return { month, day, weekday, hour, minute };
}
