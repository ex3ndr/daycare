import type { ModelRoleKey } from "../../../settings.js";

export type AgentKind =
    | "connector"
    | "agent"
    | "swarm"
    | "cron"
    | "task"
    | "subuser"
    | "system"
    | "sub"
    | "memory"
    | "search";

export type AgentConfig = {
    kind?: AgentKind;
    modelRole?: ModelRoleKey | null;
    connectorName?: string | null;
    parentAgentId?: string | null;
    foreground: boolean;
    name: string | null;
    description: string | null;
    systemPrompt: string | null;
    workspaceDir: string | null;
};
