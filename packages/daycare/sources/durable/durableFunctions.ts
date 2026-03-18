import type { Context } from "@/types";
import type { DelayedSignals } from "../engine/signals/delayedSignals.js";
import type { DaycareRole } from "../utils/hasRole.js";

export type DurableFunctionServices = {
    delayedSignals: Pick<DelayedSignals, "deliver">;
};

export type DurableFunctionHandlerContext<TInput> = {
    ctx: Context;
    input: TInput;
    services: DurableFunctionServices;
};

export type DurableFunctionDefinition<TName extends string, TInput, TOutput> = {
    name: TName;
    description: string;
    event: string;
    functionId: string;
    enabledRoles?: readonly DaycareRole[];
    dedupeKey?: (ctx: Context, input: TInput) => string | null;
    handler: (context: DurableFunctionHandlerContext<TInput>) => Promise<TOutput>;
};

export const durableFunctionDefinitions = {
    delayedSignalDeliver: durableFunctionDefine<"delayedSignalDeliver", { delayedSignalId: string }, null>({
        name: "delayedSignalDeliver",
        description: "Deliver a persisted delayed signal by id.",
        event: "daycare/durable.delayed-signal-deliver",
        functionId: "durable-delayed-signal-deliver",
        enabledRoles: ["api", "agents", "signals"],
        dedupeKey: (ctx, input) => `${ctx.userId}:${input.delayedSignalId}`,
        handler: async ({ ctx, input, services }) => {
            await services.delayedSignals.deliver(ctx, input.delayedSignalId);
            return null;
        }
    })
} as const;

export type DurableFunctionName = keyof typeof durableFunctionDefinitions;
export const DURABLE_FUNCTION_NAMES = Object.keys(durableFunctionDefinitions) as DurableFunctionName[];

export type DurableFunctionInput<TName extends DurableFunctionName> = Parameters<
    (typeof durableFunctionDefinitions)[TName]["handler"]
>[0]["input"];

export type DurableFunctionOutput<TName extends DurableFunctionName> = Awaited<
    ReturnType<(typeof durableFunctionDefinitions)[TName]["handler"]>
>;

/**
 * Returns the durable function definition for the given catalog name.
 * Expects: `name` matches one of the definitions exported from this module.
 */
export function durableFunctionDefinitionGet<TName extends DurableFunctionName>(
    name: TName
): (typeof durableFunctionDefinitions)[TName] {
    return durableFunctionDefinitions[name];
}

/**
 * Returns the durable functions enabled for the provided runtime roles.
 * Expects: an empty role list means "no role filter" to preserve local/dev behavior.
 */
export function durableFunctionNamesForRoles(roles: readonly DaycareRole[]): DurableFunctionName[] {
    return DURABLE_FUNCTION_NAMES.filter((name) => durableFunctionEnabled(name, roles));
}

/**
 * Returns whether a durable function is enabled for the provided runtime roles.
 * Expects: an empty role list means "no role filter" to preserve local/dev behavior.
 */
export function durableFunctionEnabled<TName extends DurableFunctionName>(
    name: TName,
    roles: readonly DaycareRole[]
): boolean {
    const enabledRoles = durableFunctionDefinitions[name].enabledRoles;
    if (!enabledRoles || enabledRoles.length === 0 || roles.length === 0) {
        return true;
    }
    return enabledRoles.some((role) => roles.includes(role));
}

/**
 * Returns a stable dedupe key for a durable function schedule when available.
 * Expects: callers pass the same `ctx` and input for duplicate schedule attempts.
 */
export function durableFunctionKey<TName extends DurableFunctionName>(
    ctx: Context,
    name: TName,
    input: DurableFunctionInput<TName>
): string | null {
    return durableFunctionDefinitions[name].dedupeKey?.(ctx, input) ?? null;
}

function durableFunctionDefine<TName extends string, TInput, TOutput>(
    definition: DurableFunctionDefinition<TName, TInput, TOutput>
): DurableFunctionDefinition<TName, TInput, TOutput> {
    return definition;
}
