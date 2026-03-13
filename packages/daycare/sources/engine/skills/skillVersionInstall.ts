import { promises as fs } from "node:fs";
import path from "node:path";
import { skillVersionStateRead } from "./skillVersionStateRead.js";

const VERSION_RECORD_FILENAME = "current.json";
const VERSION_HISTORY_DIRNAME = "versions";

/**
 * Installs a personal skill and archives the previous current copy as a numbered version.
 * Expects: sourceDir is a validated skill folder and skillName is safe for filesystem paths.
 */
export async function skillVersionInstall(input: {
    personalRoot: string;
    historyRoot: string;
    skillName: string;
    sourceDir: string;
}): Promise<{ status: "installed" | "replaced"; version: number }> {
    const state = await skillVersionStateRead({
        personalRoot: input.personalRoot,
        historyRoot: input.historyRoot,
        skillName: input.skillName
    });
    const targetDir = state.currentPath;
    const currentSourceDir = state.existingCurrentPath ?? state.currentPath;
    const skillHistoryRoot = path.join(input.historyRoot, input.skillName);

    if (state.currentVersion !== null) {
        const versionDir = path.join(skillHistoryRoot, VERSION_HISTORY_DIRNAME, String(state.currentVersion));
        await fs.mkdir(path.dirname(versionDir), { recursive: true });
        await fs.rm(versionDir, { recursive: true, force: true });
        await fs.cp(currentSourceDir, versionDir, { recursive: true });
    }

    await fs.rm(currentSourceDir, { recursive: true, force: true });
    await fs.mkdir(input.personalRoot, { recursive: true });
    await fs.cp(input.sourceDir, targetDir, { recursive: true });
    await fs.mkdir(skillHistoryRoot, { recursive: true });
    await fs.writeFile(
        path.join(skillHistoryRoot, VERSION_RECORD_FILENAME),
        `${JSON.stringify({ currentVersion: state.nextVersion }, null, 4)}\n`
    );

    return {
        status: state.currentVersion === null ? "installed" : "replaced",
        version: state.nextVersion
    };
}
