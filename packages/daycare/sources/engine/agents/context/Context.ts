import { contextJsonValueFreeze } from "./contextJsonValueFreeze.js";
import type { ContextDurableState, ContextJson, ContextJsonValue, ContextNamespaceValues } from "./contextTypes.js";

const EMPTY_NAMESPACES: Readonly<ContextNamespaceValues> = Object.freeze({});

const contextAgentIds = new WeakMap<Context, string | null>();
const contextNamespaces = new WeakMap<Context, Readonly<ContextNamespaceValues>>();

/**
 * Readonly context carrying built-in identity fields plus immutable namespace extras.
 * Passed explicitly through user-scoped code and durable boundaries.
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
        contextNamespaces.set(this, contextNamespacesBuild(input.namespaces));
        Object.defineProperty(this, "hasAgentId", {
            configurable: false,
            enumerable: true,
            get: () => {
                return contextAgentIds.get(this) !== null;
            }
        });
        Object.freeze(this);
    }

    get agentId(): string {
        const agentId = contextAgentIds.get(this);
        if (!agentId) {
            throw new Error("Context has no agentId");
        }
        return agentId;
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
     * Expects: `serialized` was produced by `contextSerialize()`.
     */
    static deserialize(serialized: string): Context {
        let parsed: unknown;
        try {
            parsed = JSON.parse(serialized);
        } catch (error) {
            throw new Error(`Invalid serialized Context: ${error instanceof Error ? error.message : String(error)}`);
        }

        if (!isRecord(parsed) || parsed.version !== 1 || !("ctx" in parsed) || !isRecord(parsed.ctx)) {
            throw new Error("Invalid serialized Context envelope.");
        }

        return new Context(parsed.ctx as ContextJson);
    }
}

export function contextNamespacesRead(ctx: Context): Readonly<ContextNamespaceValues> {
    return contextNamespaces.get(ctx) ?? EMPTY_NAMESPACES;
}

export function contextNamespaceValueGet<TValue extends ContextJsonValue>(
    ctx: Context,
    id: string
): TValue | undefined {
    const normalizedId = requiredId(id, "Context namespace id");
    return contextNamespacesRead(ctx)[normalizedId] as TValue | undefined;
}

export function contextNamespaceValueSet<TValue extends ContextJsonValue>(
    ctx: Context,
    id: string,
    value: TValue
): Context {
    const normalizedId = requiredId(id, "Context namespace id");
    const nextNamespaces: ContextNamespaceValues = {
        ...contextNamespacesRead(ctx),
        [normalizedId]: contextJsonValueFreeze(value)
    };
    return new Context({
        userId: ctx.userId,
        ...(ctx.personUserId ? { personUserId: ctx.personUserId } : {}),
        ...(ctx.hasAgentId ? { agentId: ctx.agentId } : {}),
        ...(ctx.durable ? { durable: ctx.durable } : {}),
        namespaces: nextNamespaces
    });
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
        kind: requiredId(input.kind, "Context durable kind") as ContextDurableState["kind"]
    });
}

function contextNamespacesBuild(input: ContextNamespaceValues | undefined): Readonly<ContextNamespaceValues> {
    if (input === undefined) {
        return EMPTY_NAMESPACES;
    }

    const next: ContextNamespaceValues = {};
    for (const [key, value] of Object.entries(input)) {
        next[requiredId(key, "Context namespace id")] = contextJsonValueFreeze(value);
    }
    return Object.freeze(next);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}
