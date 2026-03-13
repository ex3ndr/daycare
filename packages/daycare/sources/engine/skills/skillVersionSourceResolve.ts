import { skillVersionStateRead } from "./skillVersionStateRead.js";

/**
 * Resolves the on-disk folder for the requested current or archived personal skill version.
 * Expects: version is omitted for current or is a positive integer when provided.
 */
export async function skillVersionSourceResolve(input: {
    personalRoot: string;
    historyRoot: string;
    skillName: string;
    version?: number;
}): Promise<{ path: string; version: number }> {
    const state = await skillVersionStateRead(input);
    if (input.version !== undefined) {
        if (!Number.isSafeInteger(input.version) || input.version <= 0) {
            throw new Error("Skill version must be a positive integer.");
        }
        if (state.currentVersion === input.version) {
            return { path: state.existingCurrentPath ?? state.currentPath, version: input.version };
        }
        const previous = state.previousVersions.find((entry) => entry.version === input.version);
        if (!previous) {
            throw new Error(`Personal skill version not found: "${input.skillName}" v${input.version}.`);
        }
        return { path: previous.path, version: previous.version };
    }

    if (state.currentVersion === null) {
        throw new Error(`Personal skill not found: "${input.skillName}".`);
    }
    return { path: state.existingCurrentPath ?? state.currentPath, version: state.currentVersion };
}
