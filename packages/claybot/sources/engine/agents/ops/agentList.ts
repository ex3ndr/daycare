import { promises as fs } from "node:fs";

import type { Config } from "@/types";
import type { AgentDescriptor } from "./agentDescriptorTypes.js";
import { agentDescriptorRead } from "./agentDescriptorRead.js";
import { agentStateRead } from "./agentStateRead.js";

/**
 * Lists persisted agents with descriptors and last-updated timestamps.
 * Expects: agentsDir may be missing when no agents have been created yet.
 */
export async function agentList(
  config: Config
): Promise<Array<{ agentId: string; descriptor: AgentDescriptor; updatedAt: number }>> {
  let entries: Array<{ name: string; isDirectory: () => boolean }> = [];
  try {
    entries = await fs.readdir(config.agentsDir, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const results: Array<{ agentId: string; descriptor: AgentDescriptor; updatedAt: number }> = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const agentId = entry.name;
    let descriptor: AgentDescriptor | null = null;
    let state: Awaited<ReturnType<typeof agentStateRead>> = null;
    try {
      descriptor = await agentDescriptorRead(config, agentId);
      state = await agentStateRead(config, agentId);
    } catch {
      continue;
    }
    if (!descriptor || !state) {
      continue;
    }
    results.push({ agentId, descriptor, updatedAt: state.updatedAt });
  }
  return results;
}
