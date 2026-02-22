import path from "node:path";

type SandboxDangerousFiles = {
    files: string[];
    directories: string[];
};

/**
 * Checks whether a target path matches dangerous sandbox-runtime patterns.
 * Expects: dangerous patterns are relative names, target is absolute or resolvable.
 */
export function sandboxDangerousFileCheck(target: string, dangerous: SandboxDangerousFiles): boolean {
    const resolvedTarget = path.resolve(target);
    const targetBasename = path.basename(resolvedTarget);
    if (dangerous.files.some((entry) => entry === targetBasename)) {
        return true;
    }

    const targetSegments = path
        .normalize(resolvedTarget)
        .split(path.sep)
        .filter((entry) => entry.length > 0);
    return dangerous.directories.some((entry) => hasDirectoryPattern(targetSegments, entry));
}

function hasDirectoryPattern(targetSegments: string[], pattern: string): boolean {
    const patternSegments = pattern.split(/[\\/]/u).filter((entry) => entry.length > 0);
    if (patternSegments.length === 0 || patternSegments.length > targetSegments.length) {
        return false;
    }

    for (let index = 0; index <= targetSegments.length - patternSegments.length; index += 1) {
        let allMatch = true;
        for (let offset = 0; offset < patternSegments.length; offset += 1) {
            if (targetSegments[index + offset] !== patternSegments[offset]) {
                allMatch = false;
                break;
            }
        }
        if (allMatch) {
            return true;
        }
    }

    return false;
}
