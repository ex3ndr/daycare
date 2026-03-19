import type { AgentInboxItem, AgentPath, ConnectorMessage, ConnectorRecipient, Context, MessageContext } from "@/types";
import type { ConnectorRegistry } from "../engine/modules/connectorRegistry.js";
import type { DelayedSignals } from "../engine/signals/delayedSignals.js";
import type { DaycareRole } from "../utils/hasRole.js";

export type DurableFunctionServices = {
    delayedSignals: Pick<DelayedSignals, "deliver">;
    connectorRegistry: Pick<ConnectorRegistry, "get">;
    agentPost: (
        ctx: Context,
        target: { path: AgentPath },
        item: AgentInboxItem,
        config: { kind: "connector"; foreground: boolean; connector: ConnectorRecipient | null }
    ) => Promise<void>;
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
    } satisfies DurableFunctionDefinition<"delayedSignalDeliver", { delayedSignalId: string }, null>,

    connectorSendMessage: {
        name: "connectorSendMessage",
        description: "Send a message through a named connector.",
        enabledRoles: ["connectors"],
        handler: async ({ input, services }) => {
            const connector = services.connectorRegistry.get(input.connectorName);
            if (!connector) {
                throw new Error(`Connector not loaded: ${input.connectorName}`);
            }
            await connector.sendMessage(input.recipient, input.message);
            return null;
        }
    } satisfies DurableFunctionDefinition<
        "connectorSendMessage",
        { connectorName: string; recipient: ConnectorRecipient; message: ConnectorMessage },
        null
    >,

    connectorReceiveMessage: {
        name: "connectorReceiveMessage",
        description: "Append an incoming connector message to an agent inbox.",
        enabledRoles: ["agents"],
        handler: async ({ ctx, input, services }) => {
            await services.agentPost(
                ctx,
                { path: input.path },
                { type: "message", message: input.message, context: input.context },
                { kind: "connector", foreground: true, connector: input.connector }
            );
            return null;
        }
    } satisfies DurableFunctionDefinition<
        "connectorReceiveMessage",
        {
            path: AgentPath;
            message: ConnectorMessage;
            context: MessageContext;
            connector: ConnectorRecipient | null;
        },
        null
    >
} as const;

export type DurableFunctionName = keyof typeof durableFunctionDefinitions;

export type DurableFunctionInput<TName extends DurableFunctionName> = Parameters<
    (typeof durableFunctionDefinitions)[TName]["handler"]
>[0]["input"];

export type DurableFunctionOutput<TName extends DurableFunctionName> = Awaited<
    ReturnType<(typeof durableFunctionDefinitions)[TName]["handler"]>
>;
