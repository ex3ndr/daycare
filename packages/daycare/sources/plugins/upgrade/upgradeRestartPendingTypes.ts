import type { AgentDescriptor, MessageContext } from "@/types";

export type UpgradeRestartPending = {
  descriptor: AgentDescriptor;
  context: MessageContext;
  requestedAtMs: number;
  requesterPid: number;
  previousVersion?: string;
};
