import path from "node:path";

/**
 * Rewrites a container /home/<userId> path into its host mounted home directory path.
 * Expects: targetPath uses POSIX separators when provided as a container path.
 */
export function sandboxPathContainerToHost(
    hostHomeDir: string,
    _userId: string,
    targetPath: string,
    hostSkillsActiveDir?: string,
    hostExamplesDir?: string
): string {
    if (!path.posix.isAbsolute(targetPath)) {
        return targetPath;
    }

    const containerHomeDir = "/home";
    const containerSkillsDir = "/shared/skills";
    const containerExamplesDir = "/shared/examples";
    const normalizedTarget = path.posix.normalize(targetPath);

    if (hostSkillsActiveDir) {
        if (normalizedTarget === containerSkillsDir) {
            return path.resolve(hostSkillsActiveDir);
        }
        if (normalizedTarget.startsWith(`${containerSkillsDir}/`)) {
            const relativePath = normalizedTarget.slice(containerSkillsDir.length + 1);
            return path.resolve(hostSkillsActiveDir, ...relativePath.split("/"));
        }
    }

    if (hostExamplesDir) {
        if (normalizedTarget === containerExamplesDir) {
            return path.resolve(hostExamplesDir);
        }
        if (normalizedTarget.startsWith(`${containerExamplesDir}/`)) {
            const relativePath = normalizedTarget.slice(containerExamplesDir.length + 1);
            return path.resolve(hostExamplesDir, ...relativePath.split("/"));
        }
    }

    if (normalizedTarget === containerHomeDir) {
        return path.resolve(hostHomeDir);
    }

    if (!normalizedTarget.startsWith(`${containerHomeDir}/`)) {
        return targetPath;
    }

    const relativePath = normalizedTarget.slice(containerHomeDir.length + 1);
    if (relativePath.length === 0) {
        return path.resolve(hostHomeDir);
    }

    return path.resolve(hostHomeDir, ...relativePath.split("/"));
}
