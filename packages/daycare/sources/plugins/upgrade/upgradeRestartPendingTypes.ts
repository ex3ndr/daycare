import type { AgentPath, MessageContext } from "@/types";

export type UpgradeRestartPending = {
    path: AgentPath;
    context: MessageContext;
    requestedAtMs: number;
    requesterPid: number;
    previousVersion?: string;
};
