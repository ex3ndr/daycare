import { type DurableFunctionName, durableFunctionDefinitions } from "./durableFunctions.js";

/**
 * Returns the durable function definition for the given catalog name.
 * Expects: `name` matches one of the definitions exported from `durableFunctions.ts`.
 */
export function durableFunctionDefinitionGet<TName extends DurableFunctionName>(
    name: TName
): (typeof durableFunctionDefinitions)[TName] {
    return durableFunctionDefinitions[name];
}
