import { promises as fs } from "node:fs";
import path from "node:path";
import matter from "gray-matter";

import { getLogger } from "../../log.js";
import { skillActivationKeyBuild } from "./skillActivationKeyBuild.js";
import type { AgentSkill } from "./skillTypes.js";

const logger = getLogger("engine.skills");
const NFS_TEMP_PREFIX = ".nfs";

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
        await directoryResetNfsTolerant(targetSkillDir);
        await fs.cp(sourceSkillDir, targetSkillDir, { recursive: true, force: true });
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
        await pathRemoveNfsTolerant(stalePath);
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

// NFS can leave open deleted files behind as transient .nfs* placeholders.
async function directoryResetNfsTolerant(targetDir: string): Promise<void> {
    await fs.mkdir(targetDir, { recursive: true });
    const entries = await fs.readdir(targetDir, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.name.startsWith(NFS_TEMP_PREFIX)) {
            continue;
        }

        const entryPath = path.join(targetDir, entry.name);
        if (entry.isDirectory()) {
            await directoryResetNfsTolerant(entryPath);
            await directoryRemoveIfEmpty(entryPath);
            continue;
        }

        await pathRemoveNfsTolerant(entryPath);
    }
}

async function pathRemoveNfsTolerant(targetPath: string): Promise<void> {
    const stats = await fileStatSafe(targetPath);
    if (!stats) {
        return;
    }

    if (stats.isDirectory()) {
        await directoryResetNfsTolerant(targetPath);
        await directoryRemoveIfEmpty(targetPath);
        return;
    }

    try {
        await fs.rm(targetPath, { force: true });
    } catch (error) {
        if (path.basename(targetPath).startsWith(NFS_TEMP_PREFIX) && errorCode(error) === "EBUSY") {
            return;
        }
        throw error;
    }
}

async function directoryRemoveIfEmpty(targetDir: string): Promise<void> {
    try {
        await fs.rmdir(targetDir);
    } catch (error) {
        const code = errorCode(error);
        if (code === "ENOENT" || code === "ENOTEMPTY" || code === "EEXIST") {
            return;
        }
        throw error;
    }
}

function errorCode(error: unknown): string | undefined {
    return (error as NodeJS.ErrnoException).code;
}
