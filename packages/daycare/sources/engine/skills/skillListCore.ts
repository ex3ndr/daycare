import { fileURLToPath } from "node:url";

import { skillListFromRoot } from "./skillListFromRoot.js";
import type { AgentSkill } from "./skillTypes.js";

const CORE_SKILLS_ROOT = fileURLToPath(new URL("../../skills", import.meta.url));

/**
 * Lists Daycare core skills bundled with the package.
 *
 * Expects: packaged skills directory exists or is missing; missing returns an empty list.
 */
export async function skillListCore(): Promise<AgentSkill[]> {
  return skillListFromRoot(CORE_SKILLS_ROOT, { source: "core", root: CORE_SKILLS_ROOT });
}
