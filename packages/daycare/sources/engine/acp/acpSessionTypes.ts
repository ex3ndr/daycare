import type { StopReason } from "@agentclientprotocol/sdk";
import type { Context } from "@/types";

export type AcpPermissionMode = "allow" | "deny";

export type AcpSessionCreateInput = {
    ctx: Context;
    ownerAgentId: string;
    ownerAgentName: string | null;
    description: string;
    command: string;
    args: string[];
    cwd: string;
    env?: Record<string, string>;
    permissionMode: AcpPermissionMode;
};

export type AcpSessionInfo = {
    id: string;
    remoteSessionId: string;
    userId: string;
    ownerAgentId: string;
    ownerAgentName: string | null;
    description: string;
    command: string;
    args: string[];
    cwd: string;
    permissionMode: AcpPermissionMode;
    createdAt: number;
    updatedAt: number;
};

export type AcpSessionPromptResult = {
    sessionId: string;
    stopReason: StopReason;
    answer: string;
};
