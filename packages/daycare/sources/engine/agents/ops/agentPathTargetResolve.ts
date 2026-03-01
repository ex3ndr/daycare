import type { AgentConfig, AgentPath } from "@/types";
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
    config: Pick<AgentConfig, "connectorName">,
    path?: AgentPath | null
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
    const targetHint = connectorTargetHintResolve(path, connector);
    if (targetHint) {
        const exactKey = `${prefix}${targetHint}`;
        const exact = user.connectorKeys.find((entry) => entry.connectorKey === exactKey)?.connectorKey;
        if (exact) {
            return { connector, targetId: targetHint };
        }
        const legacyFallback = connectorTargetLegacyFallback(targetHint);
        if (legacyFallback) {
            const fallbackKey = `${prefix}${legacyFallback}`;
            const fallback = user.connectorKeys.find((entry) => entry.connectorKey === fallbackKey)?.connectorKey;
            if (fallback) {
                return { connector, targetId: legacyFallback };
            }
        }
    }
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

function connectorTargetHintResolve(path: AgentPath | null | undefined, connector: string): string | null {
    if (!path) {
        return null;
    }
    const segments = String(path)
        .split("/")
        .filter((segment) => segment.length > 0);
    if (segments.length < 3) {
        return null;
    }
    if ((segments[1]?.trim() ?? "") !== connector) {
        return null;
    }
    const targetSegments = segments
        .slice(2)
        .map((segment) => segment.trim())
        .filter(Boolean);
    if (targetSegments.length === 0) {
        return null;
    }
    return targetSegments.join("/");
}

function connectorTargetLegacyFallback(targetHint: string): string | null {
    const segments = targetHint
        .split("/")
        .map((segment) => segment.trim())
        .filter(Boolean);
    const channelId = segments[0] ?? "";
    const senderUserId = segments[1] ?? "";
    if (!channelId || !senderUserId) {
        return null;
    }
    return channelId === senderUserId ? channelId : null;
}
