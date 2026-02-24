import { promises as fs } from "node:fs";
import path from "node:path";
import matter from "gray-matter";

import { getLogger } from "../../log.js";
import { skillActivationKeyBuild } from "./skillActivationKeyBuild.js";
import type { AgentSkill } from "./skillTypes.js";

const logger = getLogger("engine.skills");

/**
 * Syncs current skills into a managed active root for sandbox mounting.
 * Expects: activeRoot is writable on host and skills contain readable sourcePath values.
 */
export async function skillActivationSync(skills: AgentSkill[], activeRoot: string): Promise<void> {
    const resolvedActiveRoot = path.resolve(activeRoot);
    await fs.mkdir(resolvedActiveRoot, { recursive: true });

    const expectedKeys = new Set<string>();
    for (const skill of skills) {
        let activationKey = "";
        try {
            activationKey = skillActivationKeyBuild(skill.id);
        } catch (error) {
            logger.warn({ skillId: skill.id, error }, "skip: Invalid skill id for activation copy; skipping");
            continue;
        }
        expectedKeys.add(activationKey);
        await skillActivateCopy(skill, resolvedActiveRoot, activationKey);
    }

    await skillActivationCleanupStale(resolvedActiveRoot, expectedKeys);
}

async function skillActivateCopy(skill: AgentSkill, activeRoot: string, activationKey: string): Promise<void> {
    const sourceSkillPath = path.resolve(skill.sourcePath);
    const sourceSkillDir = path.dirname(sourceSkillPath);
    const targetSkillDir = path.resolve(activeRoot, activationKey);
    if (!pathIsWithinRoot(activeRoot, targetSkillDir)) {
        logger.warn(
            { skillId: skill.id, activeRoot, targetSkillDir },
            "skip: Activation target resolved outside active root; skipping"
        );
        return;
    }

    const sourceStats = await fileStatSafe(sourceSkillPath);
    if (!sourceStats?.isFile()) {
        logger.warn({ skillId: skill.id, sourcePath: sourceSkillPath }, "skip: Skill source missing; skipping");
        return;
    }
    if (!(await skillFrontmatterHasName(sourceSkillPath))) {
        logger.warn({ skillId: skill.id, sourcePath: sourceSkillPath }, "skip: Skill frontmatter missing name");
        return;
    }

    const targetSkillPath = path.join(targetSkillDir, path.basename(sourceSkillPath));
    const targetStats = await fileStatSafe(targetSkillPath);
    if (targetStats?.isFile() && targetStats.mtimeMs >= sourceStats.mtimeMs) {
        return;
    }

    try {
        await fs.rm(targetSkillDir, { recursive: true, force: true });
        await fs.cp(sourceSkillDir, targetSkillDir, { recursive: true });
    } catch (error) {
        logger.warn({ skillId: skill.id, sourcePath: sourceSkillPath, targetSkillDir, error }, "skip: Copy failed");
    }
}

async function skillActivationCleanupStale(activeRoot: string, expectedKeys: Set<string>): Promise<void> {
    const entries = await fs.readdir(activeRoot, { withFileTypes: true });
    for (const entry of entries) {
        if (expectedKeys.has(entry.name)) {
            continue;
        }
        const stalePath = path.join(activeRoot, entry.name);
        await fs.rm(stalePath, { recursive: true, force: true });
    }
}

async function fileStatSafe(targetPath: string): Promise<import("node:fs").Stats | null> {
    try {
        return await fs.stat(targetPath);
    } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === "ENOENT" || code === "ENOTDIR" || code === "EACCES") {
            return null;
        }
        throw error;
    }
}

async function skillFrontmatterHasName(skillPath: string): Promise<boolean> {
    let content = "";
    try {
        content = await fs.readFile(skillPath, "utf8");
    } catch {
        return false;
    }

    try {
        const parsed = matter(content);
        return typeof parsed.data.name === "string" && parsed.data.name.trim().length > 0;
    } catch {
        return false;
    }
}

function pathIsWithinRoot(root: string, target: string): boolean {
    const relative = path.relative(root, target);
    return relative.length === 0 || (!relative.startsWith("..") && !path.isAbsolute(relative));
}
