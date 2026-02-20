import type { Config } from "@/types";
import type { AgentDescriptor } from "./agentDescriptorTypes.js";
import { agentDbRead } from "../../../storage/agentDbRead.js";

/**
 * Loads an agent descriptor from SQLite storage.
 * Expects: migrations have been applied before reads.
 */
export async function agentDescriptorRead(
  config: Config,
  agentId: string
): Promise<AgentDescriptor | null> {
  const record = await agentDbRead(config, agentId);
  return record?.descriptor ?? null;
}
