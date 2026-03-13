import { promises as fs } from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { SKILL_FILENAME } from "./skillConstants.js";
import type { SkillVersionEntry, SkillVersionState } from "./skillVersionTypes.js";

const VERSION_RECORD_FILENAME = "current.json";
const VERSION_HISTORY_DIRNAME = "versions";

/**
 * Reads the current and historical version state for one personal skill.
 * Expects: skillName is already validated and roots point to one user's skill storage.
 */
export async function skillVersionStateRead(input: {
    personalRoot: string;
    historyRoot: string;
    skillName: string;
}): Promise<SkillVersionState> {
    const currentPath = path.join(input.personalRoot, input.skillName);
    const existingCurrentPath = await currentPathFind(input.personalRoot, input.skillName);
    const currentExists = existingCurrentPath !== null;
    const skillHistoryRoot = path.join(input.historyRoot, input.skillName);
    const versionsRoot = path.join(skillHistoryRoot, VERSION_HISTORY_DIRNAME);
    const previousVersions = await versionEntriesRead(versionsRoot);
    const recordedCurrentVersion = await currentVersionRead(skillHistoryRoot);
    const maxPreviousVersion = previousVersions.at(-1)?.version ?? 0;
    const currentVersion = currentExists ? Math.max(recordedCurrentVersion ?? 0, maxPreviousVersion + 1, 1) : null;
    const nextVersionBase = currentVersion ?? Math.max(recordedCurrentVersion ?? 0, maxPreviousVersion);

    return {
        skillName: input.skillName,
        currentPath,
        existingCurrentPath,
        currentVersion,
        nextVersion: nextVersionBase > 0 ? nextVersionBase + 1 : 1,
        previousVersions
    };
}

async function versionEntriesRead(versionsRoot: string): Promise<SkillVersionEntry[]> {
    let entries: Array<import("node:fs").Dirent> = [];
    try {
        entries = await fs.readdir(versionsRoot, { withFileTypes: true });
    } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === "ENOENT" || code === "ENOTDIR") {
            return [];
        }
        throw error;
    }

    const versions = await Promise.all(
        entries.map(async (entry) => {
            if (!entry.isDirectory() || !/^\d+$/.test(entry.name)) {
                return null;
            }
            const version = Number.parseInt(entry.name, 10);
            if (!Number.isSafeInteger(version) || version <= 0) {
                return null;
            }
            const versionPath = path.join(versionsRoot, entry.name);
            const stats = await fs.stat(versionPath);
            return {
                version,
                path: versionPath,
                updatedAt: Math.trunc(stats.mtimeMs)
            } satisfies SkillVersionEntry;
        })
    );

    return versions
        .filter((entry): entry is SkillVersionEntry => entry !== null)
        .sort((left, right) => left.version - right.version);
}

async function currentVersionRead(skillHistoryRoot: string): Promise<number | null> {
    let content = "";
    try {
        content = await fs.readFile(path.join(skillHistoryRoot, VERSION_RECORD_FILENAME), "utf8");
    } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === "ENOENT" || code === "ENOTDIR") {
            return null;
        }
        throw error;
    }

    try {
        const parsed = JSON.parse(content) as { currentVersion?: unknown };
        if (typeof parsed.currentVersion === "number" && Number.isSafeInteger(parsed.currentVersion)) {
            return parsed.currentVersion > 0 ? parsed.currentVersion : null;
        }
        return null;
    } catch {
        return null;
    }
}

async function currentPathFind(personalRoot: string, skillName: string): Promise<string | null> {
    try {
        const directPath = path.join(personalRoot, skillName);
        const directStats = await fs.stat(directPath);
        if (directStats.isDirectory()) {
            return directPath;
        }
    } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code !== "ENOENT" && code !== "ENOTDIR") {
            throw error;
        }
    }

    let entries: Array<import("node:fs").Dirent> = [];
    try {
        entries = await fs.readdir(personalRoot, { withFileTypes: true });
    } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === "ENOENT" || code === "ENOTDIR") {
            return null;
        }
        throw error;
    }

    const normalized = skillName.toLowerCase();
    for (const entry of entries) {
        if (!entry.isDirectory()) {
            continue;
        }
        const candidatePath = path.join(personalRoot, entry.name);
        const parsedName = await skillNameRead(path.join(candidatePath, SKILL_FILENAME));
        if (parsedName?.toLowerCase() === normalized) {
            return candidatePath;
        }
    }
    return null;
}

async function skillNameRead(skillFilePath: string): Promise<string | null> {
    let content = "";
    try {
        content = await fs.readFile(skillFilePath, "utf8");
    } catch {
        return null;
    }

    try {
        const parsed = matter(content);
        const name = parsed.data.name;
        if (typeof name === "string" && name.trim().length > 0) {
            return name.trim();
        }
        return null;
    } catch {
        return null;
    }
}
