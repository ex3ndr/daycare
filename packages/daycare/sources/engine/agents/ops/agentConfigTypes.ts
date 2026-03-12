import type { ModelRoleKey } from "../../../settings.js";
import type { ConnectorIdentity } from "../../modules/connectors/types.js";

export type AgentKind =
    | "connector"
    | "agent"
    | "app"
    | "cron"
    | "task"
    | "subuser"
    | "sub"
    | "memory"
    | "search"
    | "supervisor";

export type AgentConfig = {
    kind?: AgentKind;
    modelRole?: ModelRoleKey | null;
    connector?: ConnectorIdentity | null;
    parentAgentId?: string | null;
    foreground: boolean;
    name: string | null;
    description: string | null;
    systemPrompt: string | null;
    workspaceDir: string | null;
};
