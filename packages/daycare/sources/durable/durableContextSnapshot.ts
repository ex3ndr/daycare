import { Context } from "../types.js";

export type DurableContextSnapshot = {
    userId: string;
    personUserId?: string;
    agentId?: string;
};

/**
 * Serializes a user-scoped runtime context for durable transport.
 * Expects: `ctx` carries a valid user identity; agent identity is optional.
 */
export function durableContextSnapshot(ctx: Context): DurableContextSnapshot {
    return {
        userId: ctx.userId,
        ...(ctx.personUserId ? { personUserId: ctx.personUserId } : {}),
        ...(ctx.hasAgentId ? { agentId: ctx.agentId } : {})
    };
}

/**
 * Restores a runtime context from a durable transport snapshot.
 * Expects: the snapshot was produced by `durableContextSnapshot()`.
 */
export function durableContextRestore(snapshot: DurableContextSnapshot): Context {
    return new Context(snapshot);
}
