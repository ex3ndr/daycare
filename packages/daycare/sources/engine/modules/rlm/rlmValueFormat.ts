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
        return rlmValueFormat(valueNormalize(value));
    }
    if (Array.isArray(value)) {
        return JSON.stringify(valueNormalize(value));
    }
    if (typeof value === "object") {
        try {
            return JSON.stringify(valueNormalize(value));
        } catch {
            return String(value);
        }
    }
    return String(value);
}

function valueNormalize(value: unknown): unknown {
    if (value instanceof Map) {
        return Object.fromEntries(Array.from(value.entries(), ([key, entry]) => [key, valueNormalize(entry)]));
    }
    if (Array.isArray(value)) {
        return value.map((entry) => valueNormalize(entry));
    }
    if (typeof value === "object" && value !== null) {
        const normalized: Record<string, unknown> = {};
        for (const [key, entry] of Object.entries(value)) {
            normalized[key] = valueNormalize(entry);
        }
        return normalized;
    }
    return value;
}
