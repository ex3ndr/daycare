import type {
    DurableFunctionInput,
    DurableFunctionName,
    DurableFunctionOutput
} from "../../durable/durableFunctions.js";
import { durableInstanceCall, durableInstanceCurrentGet, durableInstanceStep } from "../../durable/durableRegistry.js";
import type { DurableRuntimeKind } from "../../durable/durableTypes.js";

const CONTEXT_BRAND = Symbol("Context.brand");
const CONTEXT_DATA = Symbol("Context.data");
const EMPTY_CONTEXT_DATA: Readonly<ContextJson> = Object.freeze({});
const EMPTY_CONTEXT_RUNTIME: Readonly<Record<string, unknown>> = Object.freeze({});

export type ContextJsonValue =
    | null
    | boolean
    | number
    | string
    | ContextJsonValue[]
    | { [key: string]: ContextJsonValue };

export type ContextJson = Record<string, ContextJsonValue>;
export type ContextSerialized = string;

export type ContextDurableState = {
    active: true;
    executionId: string;
    instanceId: string;
    kind: DurableRuntimeKind;
};

type ContextData = {
    runtime: Readonly<Record<string, unknown>>;
    serializable: Readonly<ContextJson>;
};

export type ContextNamespace<TValue> = {
    readonly id: string;
    readonly defaultValue: TValue;
    readonly serializable: boolean;
    get(ctx: Context): TValue;
    set(ctx: Context, value: TValue): Context;
};

/**
 * Readonly branded context carrying values in immutable namespaces.
 * Passed explicitly across tools, durable boundaries, and repositories.
 */
export class Context {
    private readonly [CONTEXT_BRAND] = true;
    readonly [CONTEXT_DATA]: ContextData;

    constructor(input: ContextJson = EMPTY_CONTEXT_DATA, runtime: Record<string, unknown> = EMPTY_CONTEXT_RUNTIME) {
        this[CONTEXT_DATA] = Object.freeze({
            runtime: contextRuntimeFreeze(runtime),
            serializable: contextRecordFreeze(input)
        });
        Object.freeze(this);
    }

    get userId(): string {
        return requiredId(contexts.userId.get(this), "Context userId");
    }

    get personUserId(): string | undefined {
        const personUserId = contexts.personUserId.get(this);
        return personUserId === null ? undefined : requiredId(personUserId, "Context personUserId");
    }

    get durable(): ContextDurableState | undefined {
        const durable = contexts.durable.get(this);
        return durable === null ? undefined : contextDurableBuild(durable);
    }

    get hasAgentId(): boolean {
        return contexts.agentId.get(this) !== null;
    }

    get agentId(): string {
        const agentId = contexts.agentId.get(this);
        if (agentId === null) {
            throw new Error("Context has no agentId");
        }
        return requiredId(agentId, "Context agentId");
    }

    async durableStep<TValue>(id: string, execute: () => Promise<TValue> | TValue): Promise<TValue> {
        const durable = this.durable;
        if (durable?.active !== true) {
            throw new Error("Durable step requires a durable execution context.");
        }
        return durableInstanceStep(durable.instanceId, this, requiredId(id, "Durable step id"), execute);
    }

    async durableCall<TName extends DurableFunctionName>(
        id: string,
        name: TName,
        input: DurableFunctionInput<TName>
    ): Promise<DurableFunctionOutput<TName> | undefined> {
        const instanceId = this.durable?.instanceId ?? durableInstanceCurrentGet();
        if (!instanceId) {
            throw new Error("Durable runtime is not bound to context.");
        }
        return durableInstanceCall(instanceId, this, requiredId(id, "Durable call id"), name, input);
    }

    toJSON(): ContextJson {
        return { ...this[CONTEXT_DATA].serializable };
    }

    serialize(): ContextSerialized {
        return JSON.stringify(this[CONTEXT_DATA].serializable);
    }

    static fromJSON(input: ContextJson): Context {
        return new Context(input);
    }

    static deserialize(serialized: ContextSerialized): Context {
        let parsed: unknown;
        try {
            parsed = JSON.parse(serialized);
        } catch (error) {
            throw new Error(`Invalid serialized Context: ${error instanceof Error ? error.message : String(error)}`);
        }
        if (!isRecord(parsed)) {
            throw new Error("Serialized Context must be a JSON object.");
        }
        return new Context(parsed as ContextJson);
    }
}

export const emptyContext = new Context();

export function createContextNamespace<TValue extends ContextJsonValue>(
    id: string,
    defaultValue: TValue,
    options?: { serializable?: true }
): ContextNamespace<TValue>;
export function createContextNamespace<TValue>(
    id: string,
    defaultValue: TValue,
    options: { serializable: false }
): ContextNamespace<TValue>;
export function createContextNamespace<TValue>(
    id: string,
    defaultValue: TValue,
    options?: { serializable?: boolean }
): ContextNamespace<TValue> {
    const normalizedId = requiredId(id, "Context namespace id");
    const serializable = options?.serializable !== false;
    const frozenDefaultValue = (
        serializable ? contextValueFreeze(defaultValue as ContextJsonValue) : contextRuntimeFreezeValue(defaultValue)
    ) as TValue;
    return Object.freeze({
        id: normalizedId,
        serializable,
        defaultValue: frozenDefaultValue,
        get(ctx: Context): TValue {
            const value = serializable
                ? ctx[CONTEXT_DATA].serializable[normalizedId]
                : ctx[CONTEXT_DATA].runtime[normalizedId];
            return value === undefined ? frozenDefaultValue : (value as TValue);
        },
        set(ctx: Context, value: TValue): Context {
            const nextSerializable = serializable
                ? {
                      ...ctx[CONTEXT_DATA].serializable,
                      [normalizedId]: contextValueFreeze(value as ContextJsonValue)
                  }
                : ctx[CONTEXT_DATA].serializable;
            const nextRuntime = serializable
                ? ctx[CONTEXT_DATA].runtime
                : {
                      ...ctx[CONTEXT_DATA].runtime,
                      [normalizedId]: contextRuntimeFreezeValue(value)
                  };
            return new Context(nextSerializable, nextRuntime);
        }
    }) as ContextNamespace<TValue>;
}

export const contexts = {
    userId: createContextNamespace<string>("userId", ""),
    agentId: createContextNamespace<string | null>("agentId", null),
    personUserId: createContextNamespace<string | null>("personUserId", null),
    durable: createContextNamespace<ContextDurableState | null>("durable", null, { serializable: false })
} as const;

export type Contexts = typeof contexts;

export function contextForUser(input: { userId: string; personUserId?: string }): Context {
    let ctx = contexts.userId.set(emptyContext, input.userId);
    if (input.personUserId !== undefined) {
        ctx = contexts.personUserId.set(ctx, input.personUserId);
    }
    return ctx;
}

export function contextForAgent(input: { userId: string; personUserId?: string; agentId: string }): Context {
    return contexts.agentId.set(
        contextForUser({ userId: input.userId, personUserId: input.personUserId }),
        input.agentId
    );
}

export function contextToJSON(ctx: Context): ContextJson {
    return ctx.toJSON();
}

export function contextSerialize(ctx: Context): ContextSerialized {
    return ctx.serialize();
}

function contextDurableBuild(input: ContextDurableState): ContextDurableState {
    if (input.active !== true) {
        throw new Error("Context durable state must be active.");
    }
    return Object.freeze({
        active: true,
        executionId: requiredId(input.executionId, "Context durable executionId"),
        instanceId: requiredId(input.instanceId, "Context durable instanceId"),
        kind: requiredId(input.kind, "Context durable kind") as DurableRuntimeKind
    });
}

function contextRecordFreeze(input: ContextJson): Readonly<ContextJson> {
    const next: ContextJson = {};
    for (const [key, value] of Object.entries(input)) {
        next[requiredId(key, "Context namespace id")] = contextValueFreeze(value);
    }
    return Object.freeze(next);
}

function contextRuntimeFreeze(input: Record<string, unknown>): Readonly<Record<string, unknown>> {
    const next: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
        next[requiredId(key, "Context namespace id")] = contextRuntimeFreezeValue(value);
    }
    return Object.freeze(next);
}

function contextValueFreeze<TValue extends ContextJsonValue>(value: TValue): TValue {
    if (Array.isArray(value)) {
        return Object.freeze(value.map((entry) => contextValueFreeze(entry))) as TValue;
    }
    if (isRecord(value)) {
        const next: Record<string, ContextJsonValue> = {};
        for (const [key, entry] of Object.entries(value)) {
            next[key] = contextValueFreeze(entry as ContextJsonValue);
        }
        return Object.freeze(next) as TValue;
    }
    return value;
}

function contextRuntimeFreezeValue<TValue>(value: TValue): TValue {
    if (Array.isArray(value)) {
        return Object.freeze(value.map((entry) => contextRuntimeFreezeValue(entry))) as TValue;
    }
    if (isRecord(value)) {
        const next: Record<string, unknown> = {};
        for (const [key, entry] of Object.entries(value)) {
            next[key] = contextRuntimeFreezeValue(entry);
        }
        return Object.freeze(next) as TValue;
    }
    return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredId(value: string, field: string): string {
    const normalized = value.trim();
    if (!normalized) {
        throw new Error(`${field} is required.`);
    }
    return normalized;
}
