import type { Context } from "@/types";

export const DURABLE_FUNCTION_NAMES = ["delayedSignalDeliver"] as const;
export type DurableFunctionName = (typeof DURABLE_FUNCTION_NAMES)[number];

export type DurableFunctions = {
    delayedSignalDeliver: {
        input: {
            delayedSignalId: string;
        };
        output: null;
    };
};

export type DurableFunctionInput<TName extends DurableFunctionName> = DurableFunctions[TName]["input"];
export type DurableFunctionOutput<TName extends DurableFunctionName> = DurableFunctions[TName]["output"];

export const durableFunctionDefinitions = {
    delayedSignalDeliver: {
        event: "daycare/durable.delayed-signal-deliver",
        functionId: "durable-delayed-signal-deliver"
    }
} as const satisfies Record<
    DurableFunctionName,
    {
        event: string;
        functionId: string;
    }
>;

/**
 * Returns a stable dedupe key for a durable function schedule when available.
 * Expects: callers pass the same `ctx` and input for duplicate schedule attempts.
 */
export function durableFunctionKey<TName extends DurableFunctionName>(
    ctx: Context,
    name: TName,
    input: DurableFunctionInput<TName>
): string | null {
    switch (name) {
        case "delayedSignalDeliver":
            return `${ctx.userId}:${input.delayedSignalId}`;
    }
    throw new Error(`Unsupported durable function: ${name}`);
}
