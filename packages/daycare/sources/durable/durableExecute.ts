import type { Context } from "@/types";
import type { DelayedSignals } from "../engine/signals/delayedSignals.js";
import type { DurableFunctionInput, DurableFunctionName, DurableFunctionOutput } from "./durableFunctions.js";

export type DurableExecuteOptions<TName extends DurableFunctionName> = {
    ctx: Context;
    name: TName;
    input: DurableFunctionInput<TName>;
    delayedSignals: Pick<DelayedSignals, "deliver">;
};

/**
 * Executes a durable function against live engine services.
 * Expects: dependencies reference the current engine instance for the running process.
 */
export async function durableExecute<TName extends DurableFunctionName>(
    options: DurableExecuteOptions<TName>
): Promise<DurableFunctionOutput<TName>> {
    switch (options.name) {
        case "delayedSignalDeliver":
            await options.delayedSignals.deliver(options.ctx, options.input.delayedSignalId);
            return null as DurableFunctionOutput<TName>;
    }
    throw new Error(`Unsupported durable function: ${options.name}`);
}
