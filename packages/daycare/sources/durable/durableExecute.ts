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
    const services: DurableFunctionServices = {
        delayedSignals: options.delayedSignals,
        connectorRegistry: options.connectorRegistry,
        agentPost: options.agentPost
    };
    // Cast required: TypeScript cannot narrow the union of all handler input types
    // to the specific TName variant at the call site.
    return (
        definition.handler as (ctx: {
            ctx: typeof options.ctx;
            input: typeof options.input;
            services: DurableFunctionServices;
        }) => Promise<DurableFunctionOutput<TName>>
    )({
        ctx: options.ctx,
        input: options.input,
        services
    });
}
