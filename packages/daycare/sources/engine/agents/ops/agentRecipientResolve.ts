import type { AgentConfig, ConnectorIdentity } from "@/types";

/**
 * Resolves connector identity metadata from persisted agent config.
 * Returns null when connector routing is missing or inconsistent.
 */
export function agentRecipientResolve(config: Pick<AgentConfig, "connector">): ConnectorIdentity | null {
    const name = config.connector?.name?.trim() ?? "";
    const key = config.connector?.key?.trim() ?? "";
    if (!name || !key) {
        return null;
    }
    return {
        name,
        key
    };
}
