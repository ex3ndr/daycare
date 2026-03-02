import { cronExpressionParse } from "./cronExpressionParse.js";
import { cronTimeGetNext } from "./cronTimeGetNext.js";

export type CronScheduleDescription = {
    description: string;
    nextRunAt: number | null;
    nextRunText: string | null;
};

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
const MONTH_NAMES = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December"
] as const;

/**
 * Converts a cron expression into readable text and computes the next expected run.
 * Expects: a 5-field cron expression and optional IANA timezone/from timestamp.
 */
export function cronScheduleDescribe(input: {
    expression: string;
    timezone?: string;
    fromAt?: number;
}): CronScheduleDescription {
    const expression = input.expression.trim();
    const timezone = input.timezone?.trim();
    if (!cronExpressionParse(expression)) {
        return {
            description: "Invalid cron expression.",
            nextRunAt: null,
            nextRunText: null
        };
    }

    const nowAt = input.fromAt ?? Date.now();
    const parts = cronExpressionParts(expression);
    const description = cronExpressionHumanize(parts);
    const nextRun = cronTimeGetNext(expression, new Date(nowAt), timezone);

    if (!nextRun) {
        return {
            description,
            nextRunAt: null,
            nextRunText: null
        };
    }

    const nextRunAt = nextRun.getTime();

    return {
        description,
        nextRunAt,
        nextRunText: `${cronDateFormat(nextRun, timezone)} (${timeUntilDescribe(nextRunAt - nowAt)})`
    };
}

type CronExpressionParts = [string, string, string, string, string];
type CronFieldName = "minute" | "hour" | "day" | "month" | "weekday";

function cronExpressionParts(expression: string): CronExpressionParts {
    const [minute, hour, day, month, weekday] = expression.split(/\s+/);
    return [minute!, hour!, day!, month!, weekday!];
}

function cronExpressionHumanize(parts: CronExpressionParts): string {
    const [minute, hour, day, month, weekday] = parts;

    if (parts.every((part) => part === "*")) {
        return "Every minute.";
    }

    if (minute.startsWith("*/") && hour === "*" && day === "*" && month === "*" && weekday === "*") {
        return fieldDescribe(minute, "minute");
    }

    if (fieldIsSingleNumber(minute) && hour === "*" && day === "*" && month === "*" && weekday === "*") {
        return `At minute ${String(Number(minute)).padStart(2, "0")} of every hour.`;
    }

    if (fieldIsSingleNumber(minute) && fieldIsSingleNumber(hour) && day === "*" && month === "*" && weekday === "*") {
        return `Every day at ${timeDescribe(hour, minute)}.`;
    }

    if (fieldIsSingleNumber(minute) && fieldIsSingleNumber(hour) && day === "*" && month === "*" && weekday !== "*") {
        return `On ${fieldDescribe(weekday, "weekday")} at ${timeDescribe(hour, minute)}.`;
    }

    if (fieldIsSingleNumber(minute) && fieldIsSingleNumber(hour) && day !== "*" && month === "*" && weekday === "*") {
        return `On day ${fieldDescribe(day, "day")} of every month at ${timeDescribe(hour, minute)}.`;
    }

    if (fieldIsSingleNumber(minute) && fieldIsSingleNumber(hour) && day !== "*" && month !== "*" && weekday === "*") {
        return `On ${fieldDescribe(month, "month")} ${fieldDescribe(day, "day")} at ${timeDescribe(hour, minute)}.`;
    }

    return `${[
        `Runs when minute is ${fieldDescribe(minute, "minute")}`,
        `hour is ${fieldDescribe(hour, "hour")}`,
        `day is ${fieldDescribe(day, "day")}`,
        `month is ${fieldDescribe(month, "month")}`,
        `weekday is ${fieldDescribe(weekday, "weekday")}`
    ].join(", ")}.`;
}

function timeDescribe(hour: string, minute: string): string {
    return `${String(Number(hour)).padStart(2, "0")}:${String(Number(minute)).padStart(2, "0")}`;
}

function fieldDescribe(field: string, name: CronFieldName): string {
    if (field === "*") {
        return `any ${name}`;
    }

    if (field.startsWith("*/")) {
        const step = Number(field.slice(2));
        const unit = step === 1 ? name : `${name}s`;
        return `every ${step} ${unit}`;
    }

    if (field.includes(",")) {
        return listJoin(field.split(",").map((value) => fieldValueDescribe(value, name)));
    }

    if (field.includes("-")) {
        const [start, end] = field.split("-");
        return `${fieldValueDescribe(start!, name)} through ${fieldValueDescribe(end!, name)}`;
    }

    return fieldValueDescribe(field, name);
}

function fieldValueDescribe(value: string, name: CronFieldName): string {
    const numeric = Number(value);
    if (!Number.isInteger(numeric)) {
        return value;
    }

    if (name === "weekday") {
        return WEEKDAY_NAMES[numeric] ?? value;
    }

    if (name === "month") {
        return MONTH_NAMES[numeric - 1] ?? value;
    }

    if (name === "minute" || name === "hour") {
        return String(numeric).padStart(2, "0");
    }

    return String(numeric);
}

function fieldIsSingleNumber(field: string): boolean {
    if (field.includes(",") || field.includes("-") || field.startsWith("*/") || field === "*") {
        return false;
    }
    return Number.isInteger(Number(field));
}

function listJoin(items: string[]): string {
    if (items.length === 0) {
        return "";
    }
    if (items.length === 1) {
        return items[0]!;
    }
    if (items.length === 2) {
        return `${items[0]} and ${items[1]}`;
    }
    return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function cronDateFormat(date: Date, timezone?: string): string {
    return new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: timezone,
        timeZoneName: timezone ? "short" : undefined
    }).format(date);
}

function timeUntilDescribe(delayMs: number): string {
    const minutes = Math.max(1, Math.ceil(delayMs / 60_000));
    if (minutes < 60) {
        return `in ${minutes} minute${minutes === 1 ? "" : "s"}`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (hours < 48) {
        if (remainingMinutes === 0) {
            return `in ${hours} hour${hours === 1 ? "" : "s"}`;
        }
        return `in ${hours} hour${hours === 1 ? "" : "s"} ${remainingMinutes} minute${remainingMinutes === 1 ? "" : "s"}`;
    }

    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    if (remainingHours === 0) {
        return `in ${days} day${days === 1 ? "" : "s"}`;
    }
    return `in ${days} day${days === 1 ? "" : "s"} ${remainingHours} hour${remainingHours === 1 ? "" : "s"}`;
}
