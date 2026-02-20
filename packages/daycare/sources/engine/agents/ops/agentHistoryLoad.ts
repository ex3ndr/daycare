import type { Config } from "@/types";
import { agentDbRead } from "../../../storage/agentDbRead.js";
import { sessionHistoryDbLoad } from "../../../storage/sessionHistoryDbLoad.js";
import type { AgentHistoryRecord } from "./agentTypes.js";

/**
 * Loads history records for the active session.
 * Expects: records are ordered chronologically from oldest to newest.
 */
export async function agentHistoryLoad(config: Config, agentId: string): Promise<AgentHistoryRecord[]> {
    const agent = await agentDbRead(config, agentId);
    if (!agent?.activeSessionId) {
        return [];
    }
    return sessionHistoryDbLoad(config, agent.activeSessionId);
}
