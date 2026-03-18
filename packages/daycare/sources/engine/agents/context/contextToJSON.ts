import { type Context, contextNamespacesRead } from "./Context.js";
import type { ContextJson } from "./contextTypes.js";

/**
 * Serializes context state for persistence or transport across durable boundaries.
 * Expects: callers treat the returned object as immutable.
 */
export function contextToJSON(ctx: Context): ContextJson {
    const namespaces = contextNamespacesRead(ctx);
    return {
        userId: ctx.userId,
        ...(ctx.personUserId ? { personUserId: ctx.personUserId } : {}),
        ...(ctx.hasAgentId ? { agentId: ctx.agentId } : {}),
        ...(ctx.durable ? { durable: ctx.durable } : {}),
        ...(Object.keys(namespaces).length > 0 ? { namespaces: { ...namespaces } } : {})
    };
}
