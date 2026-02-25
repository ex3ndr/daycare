import path from "node:path";

/**
 * Maps a container absolute path to its host mount path.
 * Returns null when the container path is outside mapped docker mount roots.
 * Expects: targetPath uses POSIX separators.
 */
export function sandboxPathContainerToHostMap(
    hostHomeDir: string,
    targetPath: string,
    hostSkillsActiveDir?: string,
    hostExamplesDir?: string
): string | null {
    if (!path.posix.isAbsolute(targetPath)) {
        return null;
    }

    const containerHomeDir = "/home";
    const containerSkillsDir = "/shared/skills";
    const containerExamplesDir = "/shared/examples";
    const normalizedTarget = path.posix.normalize(targetPath);

    if (normalizedTarget === containerSkillsDir) {
        return hostSkillsActiveDir ? path.resolve(hostSkillsActiveDir) : null;
    }
    if (normalizedTarget.startsWith(`${containerSkillsDir}/`)) {
        if (!hostSkillsActiveDir) {
            return null;
        }
        const relativePath = normalizedTarget.slice(containerSkillsDir.length + 1);
        return path.resolve(hostSkillsActiveDir, ...relativePath.split("/"));
    }

    if (normalizedTarget === containerExamplesDir) {
        return hostExamplesDir ? path.resolve(hostExamplesDir) : null;
    }
    if (normalizedTarget.startsWith(`${containerExamplesDir}/`)) {
        if (!hostExamplesDir) {
            return null;
        }
        const relativePath = normalizedTarget.slice(containerExamplesDir.length + 1);
        return path.resolve(hostExamplesDir, ...relativePath.split("/"));
    }

    if (normalizedTarget === containerHomeDir) {
        return path.resolve(hostHomeDir);
    }
    if (normalizedTarget.startsWith(`${containerHomeDir}/`)) {
        const relativePath = normalizedTarget.slice(containerHomeDir.length + 1);
        return path.resolve(hostHomeDir, ...relativePath.split("/"));
    }

    return null;
}
