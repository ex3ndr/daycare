import { promises as fs } from "node:fs";

import { DEFAULT_USER_SKILLS_ROOT } from "../../paths.js";
import { skillListFromRoot } from "./skillListFromRoot.js";
import type { AgentSkill } from "./skillTypes.js";

/**
 * Lists skills stored in the shared home-directory skills root.
 *
 * Expects: ~/.agents/skills may be missing; missing roots return an empty list.
 */
export async function skillListUser(): Promise<AgentSkill[]> {
    if (!(await skillRootExists(DEFAULT_USER_SKILLS_ROOT))) {
        return [];
    }
    return skillListFromRoot(DEFAULT_USER_SKILLS_ROOT, {
        source: "user",
        root: DEFAULT_USER_SKILLS_ROOT
    });
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
