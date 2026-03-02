/**
 * ISO-string based date calculations without timezone handling.
 * All operations work on local date/time values, ignoring timezone offsets.
 */

import {
    addDays,
    addHours,
    addMinutes,
    addMonths,
    addSeconds,
    addWeeks,
    addYears,
    differenceInDays,
    differenceInHours,
    differenceInMinutes,
    differenceInMonths,
    differenceInSeconds,
    differenceInWeeks,
    differenceInYears,
    endOfDay,
    endOfMonth,
    endOfWeek,
    endOfYear,
    format,
    parseISO,
    startOfDay,
    startOfMonth,
    startOfWeek,
    startOfYear,
    subDays,
    subHours,
    subMinutes,
    subMonths,
    subSeconds,
    subWeeks,
    subYears
} from "date-fns";

export type DurationUnit = "seconds" | "minutes" | "hours" | "days" | "weeks" | "months" | "years";

/**
 * Parses an ISO string to a Date object.
 * Accepts formats like "2024-01-15" or "2024-01-15T14:30:00".
 */
export function parseISODate(isoString: string): Date {
    return parseISO(isoString);
}

/**
 * Formats a Date to ISO string (date only: YYYY-MM-DD).
 */
export function toISODateString(date: Date): string {
    return format(date, "yyyy-MM-dd");
}

/**
 * Formats a Date to ISO string (datetime: YYYY-MM-DDTHH:mm:ss).
 */
export function toISODateTimeString(date: Date): string {
    return format(date, "yyyy-MM-dd'T'HH:mm:ss");
}

/**
 * Adds a duration to a date.
 */
export function addDuration(date: Date | string, amount: number, unit: DurationUnit): Date {
    const d = typeof date === "string" ? parseISO(date) : date;

    switch (unit) {
        case "seconds":
            return addSeconds(d, amount);
        case "minutes":
            return addMinutes(d, amount);
        case "hours":
            return addHours(d, amount);
        case "days":
            return addDays(d, amount);
        case "weeks":
            return addWeeks(d, amount);
        case "months":
            return addMonths(d, amount);
        case "years":
            return addYears(d, amount);
    }
}

/**
 * Subtracts a duration from a date.
 */
export function subDuration(date: Date | string, amount: number, unit: DurationUnit): Date {
    const d = typeof date === "string" ? parseISO(date) : date;

    switch (unit) {
        case "seconds":
            return subSeconds(d, amount);
        case "minutes":
            return subMinutes(d, amount);
        case "hours":
            return subHours(d, amount);
        case "days":
            return subDays(d, amount);
        case "weeks":
            return subWeeks(d, amount);
        case "months":
            return subMonths(d, amount);
        case "years":
            return subYears(d, amount);
    }
}

/**
 * Calculates the difference between two dates in the specified unit.
 */
export function dateDiff(dateLeft: Date | string, dateRight: Date | string, unit: DurationUnit): number {
    const left = typeof dateLeft === "string" ? parseISO(dateLeft) : dateLeft;
    const right = typeof dateRight === "string" ? parseISO(dateRight) : dateRight;

    switch (unit) {
        case "seconds":
            return differenceInSeconds(left, right);
        case "minutes":
            return differenceInMinutes(left, right);
        case "hours":
            return differenceInHours(left, right);
        case "days":
            return differenceInDays(left, right);
        case "weeks":
            return differenceInWeeks(left, right);
        case "months":
            return differenceInMonths(left, right);
        case "years":
            return differenceInYears(left, right);
    }
}

/**
 * Gets the start of a time period.
 */
export function startOf(date: Date | string, unit: "day" | "week" | "month" | "year"): Date {
    const d = typeof date === "string" ? parseISO(date) : date;

    switch (unit) {
        case "day":
            return startOfDay(d);
        case "week":
            return startOfWeek(d);
        case "month":
            return startOfMonth(d);
        case "year":
            return startOfYear(d);
    }
}

/**
 * Gets the end of a time period.
 */
export function endOf(date: Date | string, unit: "day" | "week" | "month" | "year"): Date {
    const d = typeof date === "string" ? parseISO(date) : date;

    switch (unit) {
        case "day":
            return endOfDay(d);
        case "week":
            return endOfWeek(d);
        case "month":
            return endOfMonth(d);
        case "year":
            return endOfYear(d);
    }
}
