import type { AgentListItem } from "./agentsTypes";

/** Well-known connector display names. */
const CONNECTOR_NAMES: Record<string, string> = {
    whatsapp: "WhatsApp",
    telegram: "Telegram",
    discord: "Discord",
    slack: "Slack",
    web: "Web Chat",
    sms: "SMS",
    email: "Email"
};

/** Capitalizes the first letter of a string. */
function capitalize(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Derives a display label for an agent without relying on path shape.
 * Expects: agent metadata comes from the app-server agent list payload.
 */
export function agentDisplayName(agent: AgentListItem): string {
    if (agent.name?.trim()) {
        return capitalize(agent.name.trim());
    }

    if (agent.kind === "connector") {
        const connectorName = agent.connector?.name?.trim() ?? "";
        if (connectorName) {
            return CONNECTOR_NAMES[connectorName] ?? capitalize(connectorName);
        }
        return "Connection";
    }
    if (agent.kind === "app") return "App Agent";
    if (agent.kind === "supervisor") return "Supervisor";
    if (agent.kind === "cron") return "Cron Task";
    if (agent.kind === "task") return "Task";
    if (agent.kind === "memory") return "Memory Worker";
    if (agent.kind === "search") return "Memory Search";
    if (agent.kind === "sub") return "Subagent";
    if (agent.kind === "subuser") return "Subuser";

    return `Agent ${agent.agentId.slice(0, 8)}`;
}
