import { skillListFromRoot } from "./skillListFromRoot.js";
import type { AgentSkill } from "./skillTypes.js";

/**
 * Lists skills stored in a user-configurable skills root.
 *
 * Expects: root is a directory path; missing roots return an empty list.
 */
export async function skillListConfig(root: string): Promise<AgentSkill[]> {
  return skillListFromRoot(root, { source: "config", root });
}
