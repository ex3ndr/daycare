import type { ConnectorMessage, ConnectorRecipient, Context } from "@/types";

/**
 * Schedules sending a message through a named connector via the durable executor.
 * Fire-and-forget: the job is persisted and executed asynchronously by the connectors role.
 */
export async function connectorSend(
    ctx: Context,
    connectorName: string,
    recipient: ConnectorRecipient,
    message: ConnectorMessage
): Promise<void> {
    await ctx.durableSchedule("connectorSendMessage", {
        connectorName,
        recipient,
        message
    });
}
