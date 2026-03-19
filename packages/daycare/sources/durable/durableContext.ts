import { Context, contexts, contextToJSON } from "../engine/agents/context.js";
import type { DurableFunctionInput, DurableFunctionName, DurableFunctionOutput } from "./durableFunctions.js";
import type { DurableRuntimeKind } from "./durableTypes.js";

export type DurableScopedCall = <TName extends DurableFunctionName>(
    ctx: Context,
    name: TName,
    input: DurableFunctionInput<TName>
) => Promise<DurableFunctionOutput<TName>>;

const durableContextCalls = new WeakMap<Context, DurableScopedCall>();

/**
 * Returns a durable-aware context bound to the current runtime execution.
 * Expects: callers pass the context that was deserialized for the current durable handler.
 */
export function durableContextBind(ctx: Context, kind: DurableRuntimeKind, call: DurableScopedCall): Context {
    const next = contexts.durable.set(Context.fromJSON(contextToJSON(ctx)), {
        active: true,
        kind
    });
    durableContextCalls.set(next, call);
    return next;
}

/**
 * Returns the durable call binding for an active durable context.
 * Expects: callers pass the runtime kind currently handling the invocation.
 */
export function durableContextCallGet(ctx: Context, kind: DurableRuntimeKind): DurableScopedCall | null {
    if (ctx.durable?.active !== true) {
        return null;
    }
    if (ctx.durable.kind !== kind) {
        throw new Error(`Durable context runtime mismatch: expected ${kind}, got ${ctx.durable.kind}.`);
    }

    const call = durableContextCalls.get(ctx);
    if (!call) {
        throw new Error("Durable context is active but runtime bindings are missing.");
    }
    return call;
}
