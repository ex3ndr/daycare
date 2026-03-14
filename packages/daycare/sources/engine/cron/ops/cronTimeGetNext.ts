import { cronExpressionParse } from "./cronExpressionParse.js";

/**
 * Calculates the next time a cron expression should run.
 *
 * Expects: a valid cron expression string and optional start date.
 * Returns: the next matching Date, or null if invalid/no match within a bounded search.
 */
export function cronTimeGetNext(expression: string, from?: Date, timezone?: string): Date | null {
    const parsed = cronExpressionParse(expression);
    if (!parsed) {
        return null;
    }

    const normalizedTimezone = timezone?.trim() ?? "";
    const formatter = timezoneFormatterCreate(normalizedTimezone);
    if (normalizedTimezone && !formatter) {
        return null;
    }

    const values = {
        minute: Array.from(parsed.minute.any ? rangeBuild(0, 59, 1) : parsed.minute.values).sort(
            (left, right) => left - right
        ),
        hour: Array.from(parsed.hour.any ? rangeBuild(0, 23, 1) : parsed.hour.values).sort(
            (left, right) => left - right
        ),
        day: Array.from(parsed.day.any ? rangeBuild(1, 31, 1) : parsed.day.values).sort((left, right) => left - right),
        month: Array.from(parsed.month.any ? rangeBuild(1, 12, 1) : parsed.month.values).sort(
            (left, right) => left - right
        ),
        weekday: Array.from(parsed.weekday.any ? rangeBuild(0, 6, 1) : parsed.weekday.values).sort(
            (left, right) => left - right
        )
    };

    const start = from?.getTime() ?? Date.now();
    let parts = datePartsFromTimestamp(Math.floor(start / 60_000) * 60_000 + 60_000, formatter);

    for (let i = 0; i < 10_000; i++) {
        const nextMonth = valueAtOrAfter(values.month, parts.month);
        if (nextMonth === null) {
            parts = datePartsCreate(parts.year + 1, values.month[0]!, 1, 0, 0);
            continue;
        }
        if (nextMonth !== parts.month) {
            parts = datePartsCreate(parts.year, nextMonth, 1, 0, 0);
            continue;
        }

        if (!values.day.includes(parts.day) || !values.weekday.includes(parts.weekday)) {
            parts = datePartsAddDays(parts, 1, values.hour[0]!, values.minute[0]!);
            continue;
        }

        const nextHour = valueAtOrAfter(values.hour, parts.hour);
        if (nextHour === null) {
            parts = datePartsAddDays(parts, 1, values.hour[0]!, values.minute[0]!);
            continue;
        }
        if (nextHour !== parts.hour) {
            parts = datePartsCreate(parts.year, parts.month, parts.day, nextHour, values.minute[0]!);
            continue;
        }

        const nextMinute = valueAtOrAfter(values.minute, parts.minute);
        if (nextMinute === null) {
            parts = datePartsAddHours(parts, 1, values.minute[0]!);
            continue;
        }
        if (nextMinute !== parts.minute) {
            parts = datePartsCreate(parts.year, parts.month, parts.day, parts.hour, nextMinute);
        }

        const timestamp = timestampFromDateParts(parts, formatter);
        if (timestamp !== null) {
            return new Date(timestamp);
        }
        parts = datePartsAddMinutes(parts, 1);
    }

    return null;
}

type CronDateParts = {
    year: number;
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

function rangeBuild(min: number, max: number, step: number): number[] {
    const values: number[] = [];
    for (let value = min; value <= max; value += step) {
        values.push(value);
    }
    return values;
}

function valueAtOrAfter(values: number[], current: number): number | null {
    return values.find((value) => value >= current) ?? null;
}

function datePartsFromTimestamp(timestamp: number, formatter: Intl.DateTimeFormat | null): CronDateParts {
    const date = new Date(timestamp);
    return formatter ? datePartsInTimezone(date, formatter) : datePartsInLocalTimezone(date);
}

function datePartsCreate(year: number, month: number, day: number, hour: number, minute: number): CronDateParts {
    const date = new Date(Date.UTC(year, month - 1, day, hour, minute));
    return {
        year: date.getUTCFullYear(),
        month: date.getUTCMonth() + 1,
        day: date.getUTCDate(),
        weekday: date.getUTCDay(),
        hour: date.getUTCHours(),
        minute: date.getUTCMinutes()
    };
}

function datePartsAddDays(parts: CronDateParts, days: number, hour: number, minute: number): CronDateParts {
    const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days, hour, minute));
    return datePartsCreate(
        date.getUTCFullYear(),
        date.getUTCMonth() + 1,
        date.getUTCDate(),
        date.getUTCHours(),
        date.getUTCMinutes()
    );
}

function datePartsAddHours(parts: CronDateParts, hours: number, minute: number): CronDateParts {
    const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour + hours, minute));
    return datePartsCreate(
        date.getUTCFullYear(),
        date.getUTCMonth() + 1,
        date.getUTCDate(),
        date.getUTCHours(),
        date.getUTCMinutes()
    );
}

function datePartsAddMinutes(parts: CronDateParts, minutes: number): CronDateParts {
    const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute + minutes));
    return datePartsCreate(
        date.getUTCFullYear(),
        date.getUTCMonth() + 1,
        date.getUTCDate(),
        date.getUTCHours(),
        date.getUTCMinutes()
    );
}

function datePartsInLocalTimezone(date: Date): CronDateParts {
    return {
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        day: date.getDate(),
        weekday: date.getDay(),
        hour: date.getHours(),
        minute: date.getMinutes()
    };
}

function timezoneFormatterCreate(timezone: string): Intl.DateTimeFormat | null {
    if (!timezone) {
        return null;
    }
    try {
        return new Intl.DateTimeFormat("en-US", {
            timeZone: timezone,
            year: "numeric",
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
    const year = Number(parts.find((part) => part.type === "year")?.value ?? "0");
    const month = Number(parts.find((part) => part.type === "month")?.value ?? "0");
    const day = Number(parts.find((part) => part.type === "day")?.value ?? "0");
    const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0") % 24;
    const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
    const weekdayName = parts.find((part) => part.type === "weekday")?.value ?? "";
    const weekday = WEEKDAY_TO_INDEX[weekdayName] ?? -1;

    return { year, month, day, weekday, hour, minute };
}

function timestampFromDateParts(parts: CronDateParts, formatter: Intl.DateTimeFormat | null): number | null {
    if (!formatter) {
        const date = new Date(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0, 0);
        const resolved = datePartsInLocalTimezone(date);
        return datePartsEqual(resolved, parts) ? date.getTime() : null;
    }

    let timestamp = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
    for (let i = 0; i < 4; i++) {
        const resolved = datePartsInTimezone(new Date(timestamp), formatter);
        const deltaMinutes =
            (Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute) -
                Date.UTC(resolved.year, resolved.month - 1, resolved.day, resolved.hour, resolved.minute)) /
            60_000;

        if (deltaMinutes === 0) {
            return timestamp;
        }
        timestamp += deltaMinutes * 60_000;
    }

    const resolved = datePartsInTimezone(new Date(timestamp), formatter);
    return datePartsEqual(resolved, parts) ? timestamp : null;
}

function datePartsEqual(left: CronDateParts, right: CronDateParts): boolean {
    return (
        left.year === right.year &&
        left.month === right.month &&
        left.day === right.day &&
        left.hour === right.hour &&
        left.minute === right.minute
    );
}
