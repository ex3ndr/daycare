import { promises as fs } from "node:fs";
import path from "node:path";

import { getLogger } from "../../log.js";
import { SKILL_FILENAME } from "./skillConstants.js";
import { skillResolve } from "./skillResolve.js";
import { skillSort } from "./skillSort.js";
import type { AgentSkill, SkillSource } from "./skillTypes.js";

const logger = getLogger("engine.skills");

/**
 * Lists skills found under the given root directory.
 *
 * Expects: root can be missing or not a directory; those cases return an empty list.
 */
export async function skillListFromRoot(root: string, source: SkillSource): Promise<AgentSkill[]> {
    const files = await collectSkillFiles(root);
    const skills: AgentSkill[] = [];
    for (const file of files) {
        const skill = await skillResolve(file, source, root);
        if (skill) {
            skills.push(skill);
        }
    }
    return skillSort(skills);
}

async function collectSkillFiles(root: string): Promise<string[]> {
    let entries: Array<import("node:fs").Dirent> = [];
    try {
        entries = await fs.readdir(root, { withFileTypes: true });
    } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === "ENOENT") {
            logger.warn({ path: root }, "skip: Skills root missing; skipping");
            return [];
        }
        if (code === "ENOTDIR") {
            logger.warn({ path: root }, "skip: Skills root is not a directory; skipping");
            return [];
        }
        throw error;
    }

    const results: string[] = [];
    for (const entry of entries) {
        const fullPath = path.join(root, entry.name);
        if (entry.isDirectory()) {
            results.push(...(await collectSkillFiles(fullPath)));
            continue;
        }
        if (!entry.isFile()) {
            continue;
        }
        if (entry.name.toLowerCase() === SKILL_FILENAME) {
            results.push(fullPath);
        }
    }

    return results;
}
