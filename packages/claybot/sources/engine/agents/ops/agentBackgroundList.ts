import { promises as fs } from "node:fs";

import type { Config } from "@/types";
import type { BackgroundAgentState } from "./agentTypes.js";
import { agentStateRead } from "./agentStateRead.js";

/**
 * Lists persisted background agents with coarse status (no in-memory queue data).
 * Expects: agentsDir may be missing when no agents have been created yet.
 */
export async function agentBackgroundList(config: Config): Promise<BackgroundAgentState[]> {
  let entries: Array<{ name: string; isDirectory: () => boolean }> = [];
  try {
    entries = await fs.readdir(config.agentsDir, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const results: BackgroundAgentState[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const agentId = entry.name;
    let state: Awaited<ReturnType<typeof agentStateRead>> = null;
    try {
      state = await agentStateRead(config, agentId);
    } catch {
      continue;
    }
    if (!state || state.agent?.kind !== "background") {
      continue;
    }
    results.push({
      agentId,
      name: state.agent.name ?? null,
      parentAgentId: state.agent.parentAgentId ?? null,
      status: "idle",
      pending: 0,
      updatedAt: state.updatedAt
    });
  }
  return results;
}
