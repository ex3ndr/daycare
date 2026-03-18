import { type Context, contextNamespaceValueGet, contextNamespaceValueSet } from "./Context.js";
import { contextJsonValueFreeze } from "./contextJsonValueFreeze.js";
import type { ContextJsonValue, ContextNamespace, ContextNamespaceValueWiden } from "./contextTypes.js";

/**
 * Creates a typed immutable namespace for extra serializable context fields.
 * Expects: namespace ids are stable and globally unique within the process.
 */
export function contextNamespaceCreate<TValue extends ContextJsonValue>(input: {
    id: string;
    defaultValue: TValue;
}): ContextNamespace<ContextNamespaceValueWiden<TValue>> {
    const defaultValue = contextJsonValueFreeze(input.defaultValue) as ContextNamespaceValueWiden<TValue>;
    const namespace = Object.freeze({
        id: input.id.trim(),
        defaultValue,
        get(ctx: Context): ContextNamespaceValueWiden<TValue> {
            const value = contextNamespaceValueGet<ContextNamespaceValueWiden<TValue>>(ctx, namespace.id);
            return value === undefined ? namespace.defaultValue : value;
        },
        set(ctx: Context, value: ContextNamespaceValueWiden<TValue>): Context {
            return contextNamespaceValueSet(ctx, namespace.id, value);
        }
    });

    if (!namespace.id) {
        throw new Error("Context namespace id is required.");
    }

    return namespace;
}
