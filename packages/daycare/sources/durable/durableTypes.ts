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
};
