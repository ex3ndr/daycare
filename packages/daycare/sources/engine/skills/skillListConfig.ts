import { promises as fs } from "node:fs";

import { skillListFromRoot } from "./skillListFromRoot.js";
import type { AgentSkill } from "./skillTypes.js";

/**
 * Lists skills stored in a user-configurable skills root.
 *
 * Expects: root is a directory path; missing roots return an empty list.
 */
export async function skillListConfig(root: string): Promise<AgentSkill[]> {
  if (!(await skillRootExists(root))) {
    return [];
  }
  return skillListFromRoot(root, { source: "config", root });
}

async function skillRootExists(root: string): Promise<boolean> {
  try {
    const stats = await fs.stat(root);
    return stats.isDirectory();
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR") {
      return false;
    }
    throw error;
  }
}
