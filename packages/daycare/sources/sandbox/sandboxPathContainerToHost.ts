import path from "node:path";

/**
 * Rewrites a container /home/<userId> path into its host mounted home directory path.
 * Expects: targetPath uses POSIX separators when provided as a container path.
 */
export function sandboxPathContainerToHost(hostHomeDir: string, userId: string, targetPath: string): string {
    if (!path.posix.isAbsolute(targetPath)) {
        return targetPath;
    }

    const containerHomeDir = "/home";
    const normalizedTarget = path.posix.normalize(targetPath);

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
