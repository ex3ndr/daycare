import type { AgentConfig, ConnectorResolvedRecipient } from "@/types";

/**
 * Resolves connector recipient metadata from persisted agent config.
 * Returns null when connector routing is missing or inconsistent.
 */
export function agentRecipientResolve(
    config: Pick<AgentConfig, "connectorName" | "connectorKey">
): ConnectorResolvedRecipient | null {
    const connectorKey = config.connectorKey?.trim() ?? "";
    if (!connectorKey) {
        return null;
    }
    const keySeparator = connectorKey.indexOf(":");
    if (keySeparator <= 0 || keySeparator === connectorKey.length - 1) {
        return null;
    }
    const keyConnector = connectorKey.slice(0, keySeparator).trim();
    if (!keyConnector) {
        return null;
    }
    const connectorName = config.connectorName?.trim() ?? "";
    if (connectorName && connectorName !== keyConnector) {
        return null;
    }
    return {
        connector: connectorName || keyConnector,
        recipient: { connectorKey }
    };
}
