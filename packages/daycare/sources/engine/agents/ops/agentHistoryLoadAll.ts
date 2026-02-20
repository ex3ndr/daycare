import type { Config } from "@/types";
import type { AgentHistoryRecord } from "./agentTypes.js";
import { sessionHistoryDbLoadAll } from "../../../storage/sessionHistoryDbLoadAll.js";

/**
 * Loads the complete persisted history stream for one agent.
 * Expects: records are returned in chronological order across sessions.
 */
export async function agentHistoryLoadAll(
  config: Config,
  agentId: string
): Promise<AgentHistoryRecord[]> {
  return sessionHistoryDbLoadAll(config, agentId);
}
