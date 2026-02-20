import type { Config } from "@/types";
import { agentDbRead } from "../../../storage/agentDbRead.js";
import { agentDbWrite } from "../../../storage/agentDbWrite.js";
import { sessionDbCreate } from "../../../storage/sessionDbCreate.js";
import { sessionHistoryDbAppend } from "../../../storage/sessionHistoryDbAppend.js";
import type { AgentHistoryRecord } from "./agentTypes.js";

/**
 * Appends a history record to the active session.
 * Expects: target agent exists.
 */
export async function agentHistoryAppend(config: Config, agentId: string, record: AgentHistoryRecord): Promise<void> {
    const agent = await agentDbRead(config, agentId);
    if (!agent) {
        throw new Error(`Agent not found for history append: ${agentId}`);
    }

    let sessionId = agent.activeSessionId;
    if (!sessionId) {
        sessionId = await sessionDbCreate(config, {
            agentId,
            createdAt: record.at
        });
        await agentDbWrite(config, {
            ...agent,
            activeSessionId: sessionId,
            updatedAt: Math.max(agent.updatedAt, record.at)
        });
    }

    await sessionHistoryDbAppend(config, { sessionId, record });
}
