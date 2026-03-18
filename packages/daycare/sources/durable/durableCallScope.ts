import { AsyncLocalStorage } from "node:async_hooks";
import type { Context } from "@/types";
import type { DurableFunctionInput, DurableFunctionName, DurableFunctionOutput } from "./durableFunctions.js";
import type { DurableRuntimeKind } from "./durableTypes.js";

export type DurableScopedCall = <TName extends DurableFunctionName>(
    ctx: Context,
    name: TName,
    input: DurableFunctionInput<TName>
) => Promise<DurableFunctionOutput<TName>>;

type DurableCallScope = {
    kind: DurableRuntimeKind;
    call: DurableScopedCall;
};

const durableCallStorage = new AsyncLocalStorage<DurableCallScope>();

/**
 * Returns the current durable execution scope when code is already inside a durable handler.
 * Expects: callers treat a null result as "not currently in durable execution".
 */
export function durableCallScopeCurrent(): DurableCallScope | null {
    return durableCallStorage.getStore() ?? null;
}

/**
 * Runs code within a durable execution scope so nested calls can use durable call semantics.
 * Expects: `scope.call` fully resolves the target durable function.
 */
export async function durableCallScopeRun<TValue>(scope: DurableCallScope, fn: () => Promise<TValue>): Promise<TValue> {
    return durableCallStorage.run(scope, fn);
}
