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
    enabledRoles?: readonly DaycareRole[];
    handler: (context: DurableFunctionHandlerContext<TInput>) => Promise<TOutput>;
};

export const durableFunctionDefinitions = {
    delayedSignalDeliver: {
        name: "delayedSignalDeliver",
        description: "Deliver a persisted delayed signal by id.",
        enabledRoles: ["api", "agents", "signals"],
        handler: async ({ ctx, input, services }) => {
            return ctx.durableStep("deliver", async () => {
                await services.delayedSignals.deliver(ctx, input.delayedSignalId);
                return null;
            });
        }
    } satisfies DurableFunctionDefinition<"delayedSignalDeliver", { delayedSignalId: string }, null>
} as const;

export type DurableFunctionName = keyof typeof durableFunctionDefinitions;

export type DurableFunctionInput<TName extends DurableFunctionName> = Parameters<
    (typeof durableFunctionDefinitions)[TName]["handler"]
>[0]["input"];

export type DurableFunctionOutput<TName extends DurableFunctionName> = Awaited<
    ReturnType<(typeof durableFunctionDefinitions)[TName]["handler"]>
>;
