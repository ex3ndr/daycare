import path from "node:path";

/**
 * Maps a host absolute path to its container mount path.
 * Returns null when the host path is outside mapped docker mount roots.
 * Expects: hostHomeDir is absolute; targetPath is host-style.
 */
export function sandboxPathHostToContainerMap(
    hostHomeDir: string,
    targetPath: string,
    hostSkillsActiveDir?: string,
    hostExamplesDir?: string
): string | null {
    if (!path.isAbsolute(targetPath)) {
        return null;
    }

    const resolvedHomeDir = path.resolve(hostHomeDir);
    const resolvedTargetPath = path.resolve(targetPath);

    if (hostSkillsActiveDir) {
        const resolvedSkillsDir = path.resolve(hostSkillsActiveDir);
        const skillsRelativePath = path.relative(resolvedSkillsDir, resolvedTargetPath);
        if (skillsRelativePath === "") {
            return "/shared/skills";
        }
        if (isWithinPath(skillsRelativePath)) {
            return path.posix.join("/shared/skills", skillsRelativePath.split(path.sep).join(path.posix.sep));
        }
    }

    if (hostExamplesDir) {
        const resolvedExamplesDir = path.resolve(hostExamplesDir);
        const examplesRelativePath = path.relative(resolvedExamplesDir, resolvedTargetPath);
        if (examplesRelativePath === "") {
            return "/shared/examples";
        }
        if (isWithinPath(examplesRelativePath)) {
            return path.posix.join("/shared/examples", examplesRelativePath.split(path.sep).join(path.posix.sep));
        }
    }

    const homeRelativePath = path.relative(resolvedHomeDir, resolvedTargetPath);
    if (homeRelativePath === "") {
        return "/home";
    }
    if (!isWithinPath(homeRelativePath)) {
        return null;
    }

    return path.posix.join("/home", homeRelativePath.split(path.sep).join(path.posix.sep));
}

function isWithinPath(relativePath: string): boolean {
    return !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
}
