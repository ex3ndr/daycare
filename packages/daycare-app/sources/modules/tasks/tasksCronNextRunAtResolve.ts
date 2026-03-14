import type { CronTriggerSummary } from "./tasksTypes";

type CronField = {
    kind: "any" | "step" | "values";
    step?: number;
    values?: number[];
};

type CronExpression = {
    minute: CronField;
    hour: CronField;
    day: CronField;
    month: CronField;
    weekday: CronField;
};

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

/**
 * Resolves the next cron fire time as a unix timestamp in milliseconds.
 * Expects: trigger.schedule uses the 5-field cron subset supported by the app runtime.
 */
export function tasksCronNextRunAtResolve(
    trigger: Pick<CronTriggerSummary, "schedule" | "timezone" | "enabled"> & {
        fromAt?: number;
    }
): number | null {
    if (!trigger.enabled) {
        return null;
    }

    const parsed = cronExpressionParse(trigger.schedule.trim());
    if (!parsed) {
        return null;
    }

    const start = trigger.fromAt ?? Date.now();
    let candidateMs = Math.floor(start / 60_000) * 60_000 + 60_000;
    const timezone = trigger.timezone.trim();
    const formatter = timezoneFormatterCreate(timezone);
    if (timezone && !formatter) {
        return null;
    }

    for (let i = 0; i < 365 * 24 * 60 * 2; i++) {
        const candidate = new Date(candidateMs);
        const parts = formatter ? datePartsInTimezone(candidate, formatter) : datePartsInLocalTimezone(candidate);

        if (
            cronFieldMatch(parsed.month, parts.month) &&
            cronFieldMatch(parsed.day, parts.day) &&
            cronFieldMatch(parsed.weekday, parts.weekday) &&
            cronFieldMatch(parsed.hour, parts.hour) &&
            cronFieldMatch(parsed.minute, parts.minute)
        ) {
            return candidateMs;
        }

        candidateMs += 60_000;
    }

    return null;
}

function cronExpressionParse(expression: string): CronExpression | null {
    const fields = expression.split(/\s+/);
    if (fields.length !== 5) {
        return null;
    }

    const [minute, hour, day, month, weekday] = fields;
    const parsed = [
        cronFieldParse(minute!, 0, 59),
        cronFieldParse(hour!, 0, 23),
        cronFieldParse(day!, 1, 31),
        cronFieldParse(month!, 1, 12),
        cronFieldParse(weekday!, 0, 6)
    ];

    if (parsed.some((field) => field === null)) {
        return null;
    }

    return {
        minute: parsed[0]!,
        hour: parsed[1]!,
        day: parsed[2]!,
        month: parsed[3]!,
        weekday: parsed[4]!
    };
}

function cronFieldParse(raw: string, min: number, max: number): CronField | null {
    if (raw === "*") {
        return { kind: "any" };
    }

    if (raw.startsWith("*/")) {
        const step = Number(raw.slice(2));
        if (!Number.isInteger(step) || step <= 0) {
            return null;
        }
        return { kind: "step", step };
    }

    const values = new Set<number>();
    for (const part of raw.split(",")) {
        if (part.includes("-")) {
            const [startRaw, endRaw] = part.split("-");
            const start = Number(startRaw);
            const end = Number(endRaw);
            if (!Number.isInteger(start) || !Number.isInteger(end) || start < min || end > max || start > end) {
                return null;
            }
            for (let value = start; value <= end; value++) {
                values.add(value);
            }
            continue;
        }

        const value = Number(part);
        if (!Number.isInteger(value) || value < min || value > max) {
            return null;
        }
        values.add(value);
    }

    return values.size > 0 ? { kind: "values", values: Array.from(values).sort((a, b) => a - b) } : null;
}

function cronFieldMatch(field: CronField, value: number): boolean {
    if (field.kind === "any") {
        return true;
    }
    if (field.kind === "step") {
        return value % (field.step ?? 1) === 0;
    }
    return field.values?.includes(value) ?? false;
}

function datePartsInLocalTimezone(date: Date): CronDateParts {
    return {
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
