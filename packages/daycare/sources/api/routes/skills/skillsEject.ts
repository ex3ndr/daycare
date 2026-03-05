import { promises as fs } from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { SKILL_FILENAME } from "../../../engine/skills/skillConstants.js";

export type SkillsEjectInput = {
    personalRoot: string;
    skillName: string;
    destinationPath: string;
};

export type SkillsEjectResult =
    | {
          ok: true;
          skillName: string;
          status: "ejected";
      }
    | {
          ok: false;
          error: string;
      };

/**
 * Copies one personal skill folder by frontmatter name to a destination path on disk.
 * Expects: personalRoot points to the caller's personal skills directory.
 */
export async function skillsEject(input: SkillsEjectInput): Promise<SkillsEjectResult> {
    const requestedName = input.skillName.trim();
    if (!requestedName) {
        return { ok: false, error: "name is required." };
    }
    const destinationPath = input.destinationPath.trim();
    if (!destinationPath) {
        return { ok: false, error: "path is required." };
    }

    try {
        const matchedDir = await skillFolderFind(input.personalRoot, requestedName);
        if (!matchedDir) {
            return { ok: false, error: `Personal skill not found: "${requestedName}".` };
        }

        await fs.mkdir(destinationPath, { recursive: true });
        const targetDir = path.join(destinationPath, path.basename(matchedDir));
        await fs.rm(targetDir, { recursive: true, force: true });
        await fs.cp(matchedDir, targetDir, { recursive: true });
        return { ok: true, skillName: requestedName, status: "ejected" };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to eject skill.";
        return { ok: false, error: message };
    }
}

async function skillFolderFind(personalRoot: string, targetName: string): Promise<string | null> {
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

    const normalized = targetName.toLowerCase();
    for (const entry of entries) {
        if (!entry.isDirectory()) {
            continue;
        }
        const skillFilePath = path.join(personalRoot, entry.name, SKILL_FILENAME);
        const name = await skillNameRead(skillFilePath);
        if (name && name.toLowerCase() === normalized) {
            return path.join(personalRoot, entry.name);
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
