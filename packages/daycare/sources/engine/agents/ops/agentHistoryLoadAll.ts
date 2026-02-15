import type { Config } from "@/types";
import type { AgentHistoryRecord } from "./agentTypes.js";
import { agentHistoryRecordsLoad } from "./agentHistoryRecordsLoad.js";

/**
 * Loads the complete persisted history stream for one agent.
 * Expects: records are returned in append order without reset/start trimming.
 */
export async function agentHistoryLoadAll(
  config: Config,
  agentId: string
): Promise<AgentHistoryRecord[]> {
  return agentHistoryRecordsLoad(config, agentId);
}
