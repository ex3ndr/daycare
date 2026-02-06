import { promises as fs } from "node:fs";

import type { Config } from "@/types";
import type { PermanentAgentSummary } from "./agentPermanentTypes.js";
import { agentDescriptorRead } from "./agentDescriptorRead.js";
import { agentStateRead } from "./agentStateRead.js";

/**
 * Lists persisted permanent agents with descriptors and timestamps.
 * Expects: agentsDir may be missing when no agents have been created yet.
 */
export async function agentPermanentList(config: Config): Promise<PermanentAgentSummary[]> {
  let entries: Array<{ name: string; isDirectory: () => boolean }> = [];
  try {
    entries = await fs.readdir(config.agentsDir, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const results: PermanentAgentSummary[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const agentId = entry.name;
    let descriptor: Awaited<ReturnType<typeof agentDescriptorRead>> = null;
    let state: Awaited<ReturnType<typeof agentStateRead>> = null;
    try {
      descriptor = await agentDescriptorRead(config, agentId);
      state = await agentStateRead(config, agentId);
    } catch {
      continue;
    }
    if (!descriptor || !state || descriptor.type !== "permanent") {
      continue;
    }
    results.push({
      agentId,
      descriptor: {
        ...descriptor,
        name: descriptor.name.trim(),
        description: descriptor.description.trim(),
        systemPrompt: descriptor.systemPrompt.trim(),
        ...(descriptor.workspaceDir ? { workspaceDir: descriptor.workspaceDir } : {})
      },
      updatedAt: state.updatedAt
    });
  }

  return results;
}
