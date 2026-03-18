import type { Context } from "@/types";
import type { DurableFunctionInput, DurableFunctionName, DurableFunctionOutput } from "./durableFunctions.js";

export const DURABLE_RUNTIME_KINDS = ["local", "inngest"] as const;
export type DurableRuntimeKind = (typeof DURABLE_RUNTIME_KINDS)[number];

export type DurableExecute = <TName extends DurableFunctionName>(
    ctx: Context,
    name: TName,
    input: DurableFunctionInput<TName>
) => Promise<DurableFunctionOutput<TName>>;

export type Durable = {
    kind: DurableRuntimeKind;
    start(): Promise<void>;
    stop(): Promise<void>;
    /**
     * Executes immediately and awaits the durable result.
     * Expects: `ctx.durable` is active for this runtime; throws otherwise.
     */
    call<TName extends DurableFunctionName>(
        ctx: Context,
        name: TName,
        input: DurableFunctionInput<TName>
    ): Promise<DurableFunctionOutput<TName>>;
    /**
     * Schedules the durable function asynchronously without waiting for completion.
     * Expects: callers treat this as fire-and-forget durable work.
     */
    schedule<TName extends DurableFunctionName>(
        ctx: Context,
        name: TName,
        input: DurableFunctionInput<TName>
    ): Promise<void>;
};
