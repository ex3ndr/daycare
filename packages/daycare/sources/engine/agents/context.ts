import type { DurableRuntimeKind } from "../../durable/durableTypes.js";

const contextAgentIds = new WeakMap<Context, string | null>();

export type ContextDurableState = {
    active: true;
    kind: DurableRuntimeKind;
};

export type ContextJson = {
    userId: string;
    personUserId?: string;
    agentId?: string;
    durable?: ContextDurableState;
};

/**
 * Readonly context carrying agent and user identity.
 * Passed to tools, signals, and scheduled tasks for user-scoped operations.
 */
export class Context {
    readonly userId: string;
    readonly personUserId?: string;
    readonly durable?: ContextDurableState;
    readonly hasAgentId?: boolean;

    constructor(input: ContextJson) {
        this.userId = requiredId(input.userId, "Context userId");
        this.personUserId =
            input.personUserId === undefined ? undefined : requiredId(input.personUserId, "Context personUserId");
        this.durable = contextDurableBuild(input.durable);
        const agentId = input.agentId === undefined ? null : requiredId(input.agentId, "Context agentId");
        contextAgentIds.set(this, agentId);
        Object.defineProperty(this, "hasAgentId", {
            configurable: false,
            enumerable: true,
            get: () => {
                return contextAgentIds.get(this) !== null;
            }
        });
    }

    get agentId(): string {
        const agentId = contextAgentIds.get(this);
        if (!agentId) {
            throw new Error("Context has no agentId");
        }
        return agentId;
    }

    /**
     * Restores a Context instance from serialized JSON state.
     * Expects: `input` was produced by `contextToJSON()` or matches that shape.
     */
    static fromJSON(input: ContextJson): Context {
        return new Context(input);
    }
}

/**
 * Creates a user-scoped context without an agent identity.
 * Expects: userId is already validated by caller.
 */
export function contextForUser(input: { userId: string; personUserId?: string }): Context {
    return new Context({ userId: input.userId, personUserId: input.personUserId });
}

/**
 * Creates an agent-scoped context with both user and agent identity.
 * Expects: userId and agentId are already validated by caller.
 */
export function contextForAgent(input: { userId: string; personUserId?: string; agentId: string }): Context {
    return new Context({ userId: input.userId, personUserId: input.personUserId, agentId: input.agentId });
}

/**
 * Serializes context state for persistence or transport across durable boundaries.
 * Expects: callers treat the returned object as immutable.
 */
export function contextToJSON(ctx: Context): ContextJson {
    return {
        userId: ctx.userId,
        ...(ctx.personUserId ? { personUserId: ctx.personUserId } : {}),
        ...(ctx.hasAgentId ? { agentId: ctx.agentId } : {}),
        ...(ctx.durable ? { durable: ctx.durable } : {})
    };
}

function requiredId(value: string, field: string): string {
    const normalized = value.trim();
    if (!normalized) {
        throw new Error(`${field} is required.`);
    }
    return normalized;
}

function contextDurableBuild(input: ContextDurableState | undefined): ContextDurableState | undefined {
    if (input === undefined) {
        return undefined;
    }
    if (input.active !== true) {
        throw new Error("Context durable state must be active.");
    }
    return Object.freeze({
        active: true,
        kind: requiredId(input.kind, "Context durable kind") as DurableRuntimeKind
    });
}
