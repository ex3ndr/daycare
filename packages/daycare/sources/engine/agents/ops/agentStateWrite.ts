import type { Config } from "@/types";
import type { AgentState } from "./agentTypes.js";
import { agentDbRead } from "../../../storage/agentDbRead.js";
import { agentDbWrite } from "../../../storage/agentDbWrite.js";

/**
 * Writes agent state to SQLite storage.
 * Expects: descriptor has been persisted before state writes.
 */
export async function agentStateWrite(
  config: Config,
  agentId: string,
  state: AgentState
): Promise<void> {
  const existing = await agentDbRead(config, agentId);
  if (!existing) {
    throw new Error(`Agent descriptor missing for state write: ${agentId}`);
  }

  await agentDbWrite(config, {
    id: agentId,
    type: existing.type,
    descriptor: existing.descriptor,
    activeSessionId: state.activeSessionId ?? existing.activeSessionId ?? null,
    permissions: state.permissions,
    tokens: state.tokens,
    stats: state.stats,
    lifecycle: state.state,
    createdAt: state.createdAt,
    updatedAt: state.updatedAt
  });
}
