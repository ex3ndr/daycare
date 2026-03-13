import { promises as fs } from "node:fs";
import path from "node:path";
import { skillVersionSourceResolve } from "../../../engine/skills/skillVersionSourceResolve.js";

export type SkillsEjectInput = {
    personalRoot: string;
    historyRoot: string;
    skillName: string;
    destinationPath: string;
    version?: number;
};

export type SkillsEjectResult =
    | {
          ok: true;
          skillName: string;
          status: "ejected";
          version: number;
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
        const matched = await skillVersionSourceResolve({
            personalRoot: input.personalRoot,
            historyRoot: input.historyRoot,
            skillName: requestedName,
            ...(input.version !== undefined ? { version: input.version } : {})
        });
        await fs.mkdir(destinationPath, { recursive: true });
        const targetDir = path.join(destinationPath, requestedName);
        await fs.rm(targetDir, { recursive: true, force: true });
        await fs.cp(matched.path, targetDir, { recursive: true });
        return { ok: true, skillName: requestedName, status: "ejected", version: matched.version };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to eject skill.";
        return { ok: false, error: message };
    }
}
