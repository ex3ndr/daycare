/**
 * Formats Monty/Python values into deterministic text for history and output fields.
 * Expects: nested maps/arrays/records are converted recursively.
 */
export function rlmValueFormat(value: unknown): string {
    if (value === null || value === undefined) {
        return "";
    }
    if (typeof value === "string") {
        return value;
    }
    if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
        return String(value);
    }
    if (value instanceof Map) {
        return rlmValueFormat(Object.fromEntries(value.entries()));
    }
    if (Array.isArray(value)) {
        return JSON.stringify(value);
    }
    if (typeof value === "object") {
        try {
            return JSON.stringify(value);
        } catch {
            return String(value);
        }
    }
    return String(value);
}
