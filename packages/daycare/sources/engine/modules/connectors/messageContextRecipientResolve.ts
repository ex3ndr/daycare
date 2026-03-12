import type { ConnectorResolvedRecipient, MessageContext } from "@/types";

/**
 * Resolves a connector recipient from explicit message context metadata.
 * Expects: connectorKey is normalized as "<connector>:<value>" when present.
 */
export function messageContextRecipientResolve(
    context: Pick<MessageContext, "connectorKey">
): ConnectorResolvedRecipient | null {
    const connectorKey = context.connectorKey?.trim() ?? "";
    if (!connectorKey) {
        return null;
    }
    const separatorIndex = connectorKey.indexOf(":");
    if (separatorIndex <= 0 || separatorIndex === connectorKey.length - 1) {
        return null;
    }
    const connector = connectorKey.slice(0, separatorIndex).trim();
    if (!connector) {
        return null;
    }
    return {
        connector,
        recipient: { connectorKey }
    };
}
