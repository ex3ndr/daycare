import type { Context } from "./Context.js";
import { contextToJSON } from "./contextToJSON.js";
import type { ContextSerialized } from "./contextTypes.js";

/**
 * Serializes a Context instance into a versioned string envelope.
 * Expects: the resulting string is stored or transported verbatim.
 */
export function contextSerialize(ctx: Context): string {
    const payload: ContextSerialized = {
        version: 1,
        ctx: contextToJSON(ctx)
    };
    return JSON.stringify(payload);
}
