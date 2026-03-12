import type { ConnectorIdentity, MessageContext } from "@/types";

/**
 * Resolves connector identity from explicit message context metadata.
 * Expects: connector contains non-empty name/key fields when present.
 */
export function messageContextRecipientResolve(context: Pick<MessageContext, "connector">): ConnectorIdentity | null {
    const name = context.connector?.name?.trim() ?? "";
    const key = context.connector?.key?.trim() ?? "";
    if (!name || !key) {
        return null;
    }
    return {
        name,
        key
    };
}
