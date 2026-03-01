import type { AgentConfig } from "@/types";
import type { Storage } from "../../../storage/storage.js";

export type AgentConnectorTarget = {
    connector: string;
    targetId: string;
};

/**
 * Resolves connector send target for a foreground agent.
 * Returns null when connector metadata is missing or key lookup fails.
 */
export async function agentPathTargetResolve(
    storage: Storage,
    userId: string,
    config: Pick<AgentConfig, "connectorName">
): Promise<AgentConnectorTarget | null> {
    const user = await storage.users.findById(userId);
    if (!user) {
        return null;
    }
    const connector = connectorResolve(config.connectorName);
    if (!connector) {
        return null;
    }
    const prefix = `${connector}:`;
    const connectorKey = user.connectorKeys.find((entry) => entry.connectorKey.startsWith(prefix))?.connectorKey;
    if (!connectorKey) {
        return null;
    }
    const targetId = connectorKey.slice(prefix.length).trim();
    if (!targetId) {
        return null;
    }
    return { connector, targetId };
}

function connectorResolve(configured: string | null | undefined): string | null {
    const configuredName = configured?.trim();
    return configuredName && configuredName.length > 0 ? configuredName : null;
}
