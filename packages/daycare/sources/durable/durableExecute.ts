import type { Context } from "@/types";
import { durableFunctionDefinitionGet } from "./durableFunctionDefinitionGet.js";
import type {
    DurableFunctionInput,
    DurableFunctionName,
    DurableFunctionOutput,
    DurableFunctionServices
} from "./durableFunctions.js";

export type DurableExecuteOptions<TName extends DurableFunctionName> = {
    ctx: Context;
    name: TName;
    input: DurableFunctionInput<TName>;
} & DurableFunctionServices;

/**
 * Executes a durable function against live engine services.
 * Expects: dependencies reference the current engine instance for the running process.
 */
export async function durableExecute<TName extends DurableFunctionName>(
    options: DurableExecuteOptions<TName>
): Promise<DurableFunctionOutput<TName>> {
    const definition = durableFunctionDefinitionGet(options.name);
    return definition.handler({
        ctx: options.ctx,
        input: options.input,
        services: {
            delayedSignals: options.delayedSignals
        }
    }) as Promise<DurableFunctionOutput<TName>>;
}
