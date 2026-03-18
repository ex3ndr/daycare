import type { ContextJsonValue } from "./contextTypes.js";

/**
 * Deep-freezes a JSON-compatible namespace value before it is stored on Context.
 * Expects: `value` contains only serializable JSON-compatible data.
 */
export function contextJsonValueFreeze<TValue extends ContextJsonValue>(value: TValue): TValue {
    if (Array.isArray(value)) {
        return Object.freeze(value.map((entry) => contextJsonValueFreeze(entry))) as TValue;
    }
    if (typeof value === "object" && value !== null) {
        const next: Record<string, ContextJsonValue> = {};
        for (const [key, entry] of Object.entries(value)) {
            next[key] = contextJsonValueFreeze(entry as ContextJsonValue);
        }
        return Object.freeze(next) as TValue;
    }
    return value;
}
