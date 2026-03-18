import type { DurableRuntimeKind } from "../../durable/durableTypes.js";

const CONTEXT_BRAND = Symbol("Context.brand");
const CONTEXT_DATA = Symbol("Context.data");
const EMPTY_CONTEXTS: Readonly<Partial<Contexts>> = Object.freeze({});

export type ContextDurableState = {
    active: true;
    kind: DurableRuntimeKind;
};

export type Contexts = {
    agentId: string;
    durable: ContextDurableState;
    personUserId: string;
};

export type ContextJson = {
    userId: string;
    contexts?: Partial<Contexts>;
};

export type ContextSerialized = {
    version: 1;
    context: ContextJson;
};

type ContextData = {
    userId: string;
    contexts: Readonly<Partial<Contexts>>;
};

/**
 * Readonly branded context carrying user identity plus a small fixed set of typed context values.
 * Passed explicitly across tools, durable boundaries, and repositories.
 */
export class Context {
    private readonly [CONTEXT_BRAND] = true;
    private readonly [CONTEXT_DATA]: ContextData;

    constructor(input: ContextJson) {
        this[CONTEXT_DATA] = Object.freeze({
            userId: requiredId(input.userId, "Context userId"),
            contexts: contextValuesBuild(input.contexts)
        });
        Object.freeze(this);
    }

    get userId(): string {
        return this[CONTEXT_DATA].userId;
    }

    get personUserId(): string | undefined {
        return this.get("personUserId");
    }

    get durable(): ContextDurableState | undefined {
        return this.get("durable");
    }

    get hasAgentId(): boolean {
        return this.get("agentId") !== undefined;
    }

    get agentId(): string {
        const agentId = this.get("agentId");
        if (!agentId) {
            throw new Error("Context has no agentId");
        }
        return agentId;
    }

    /**
     * Reads a typed context value from the fixed Contexts map.
     * Expects: `key` is one of the keys declared in `Contexts`.
     */
    get<TKey extends keyof Contexts>(key: TKey): Contexts[TKey] | undefined {
        return this[CONTEXT_DATA].contexts[key] as Contexts[TKey] | undefined;
    }

    /**
     * Returns a new Context with one typed context value replaced.
     * Expects: `key` is declared in `Contexts` and `value` matches its type.
     */
    with<TKey extends keyof Contexts>(key: TKey, value: Contexts[TKey]): Context {
        return new Context({
            userId: this.userId,
            contexts: {
                ...this[CONTEXT_DATA].contexts,
                [key]: contextValueBuild(key, value)
            }
        });
    }

    /**
     * Serializes the Context into a plain transport shape.
     * Expects: callers treat the returned object as immutable.
     */
    toJSON(): ContextJson {
        const contexts = this[CONTEXT_DATA].contexts;
        return {
            userId: this.userId,
            ...(Object.keys(contexts).length > 0 ? { contexts: { ...contexts } } : {})
        };
    }

    /**
     * Serializes the Context into a versioned string envelope.
     * Expects: the resulting string is stored or transported verbatim.
     */
    serialize(): string {
        const payload: ContextSerialized = {
            version: 1,
            context: this.toJSON()
        };
        return JSON.stringify(payload);
    }

    /**
     * Restores a Context instance from structured JSON state.
     * Expects: `input` was produced by `contextToJSON()` or matches that shape.
     */
    static fromJSON(input: ContextJson): Context {
        return new Context(input);
    }

    /**
     * Restores a Context instance from serialized string state.
     * Expects: `serialized` was produced by `contextSerialize()` or `Context.serialize()`.
     */
    static deserialize(serialized: string): Context {
        let parsed: unknown;
        try {
            parsed = JSON.parse(serialized);
        } catch (error) {
            throw new Error(`Invalid serialized Context: ${error instanceof Error ? error.message : String(error)}`);
        }

        if (!isRecord(parsed) || parsed.version !== 1 || !("context" in parsed) || !isRecord(parsed.context)) {
            throw new Error("Invalid serialized Context envelope.");
        }

        return new Context(parsed.context as ContextJson);
    }
}

/**
 * Creates a user-scoped context without an agent identity.
 * Expects: userId is already validated by caller.
 */
export function contextForUser(input: { userId: string; personUserId?: string }): Context {
    let context = new Context({ userId: input.userId });
    if (input.personUserId !== undefined) {
        context = context.with("personUserId", input.personUserId);
    }
    return context;
}

/**
 * Creates an agent-scoped context with both user and agent identity.
 * Expects: userId and agentId are already validated by caller.
 */
export function contextForAgent(input: { userId: string; personUserId?: string; agentId: string }): Context {
    return contextForUser({ userId: input.userId, personUserId: input.personUserId }).with("agentId", input.agentId);
}

/**
 * Serializes context state for persistence or transport across durable boundaries.
 * Expects: callers treat the returned object as immutable.
 */
export function contextToJSON(ctx: Context): ContextJson {
    return ctx.toJSON();
}

/**
 * Serializes a Context instance into a versioned string envelope.
 * Expects: the resulting string is stored or transported verbatim.
 */
export function contextSerialize(ctx: Context): string {
    return ctx.serialize();
}

function contextValuesBuild(input: Partial<Contexts> | undefined): Readonly<Partial<Contexts>> {
    if (input === undefined) {
        return EMPTY_CONTEXTS;
    }

    const next: Partial<Contexts> = {};
    for (const key of Object.keys(input)) {
        if (!isContextKey(key)) {
            throw new Error(`Unknown Context value "${key}".`);
        }
    }
    if (input.agentId !== undefined) {
        next.agentId = contextValueBuild("agentId", input.agentId);
    }
    if (input.personUserId !== undefined) {
        next.personUserId = contextValueBuild("personUserId", input.personUserId);
    }
    if (input.durable !== undefined) {
        next.durable = contextValueBuild("durable", input.durable);
    }
    return Object.freeze(next);
}

function contextValueBuild<TKey extends keyof Contexts>(key: TKey, value: Contexts[TKey]): Contexts[TKey] {
    if (key === "agentId") {
        return requiredId(value as string, "Context agentId") as Contexts[TKey];
    }
    if (key === "personUserId") {
        return requiredId(value as string, "Context personUserId") as Contexts[TKey];
    }
    if (key === "durable") {
        return contextDurableBuild(value as ContextDurableState) as Contexts[TKey];
    }
    throw new Error(`Unsupported Context value "${String(key)}".`);
}

function contextDurableBuild(input: ContextDurableState): ContextDurableState {
    if (input.active !== true) {
        throw new Error("Context durable state must be active.");
    }
    return Object.freeze({
        active: true,
        kind: requiredId(input.kind, "Context durable kind") as DurableRuntimeKind
    });
}

function isContextKey(value: string): value is keyof Contexts {
    return value === "agentId" || value === "durable" || value === "personUserId";
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function requiredId(value: string, field: string): string {
    const normalized = value.trim();
    if (!normalized) {
        throw new Error(`${field} is required.`);
    }
    return normalized;
}
