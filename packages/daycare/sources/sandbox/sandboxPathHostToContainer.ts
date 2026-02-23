import path from "node:path";

/**
 * Rewrites a host path under user home into its container /home/<userId> equivalent.
 * Expects: hostHomeDir is the host-side user home mount; absolute input paths are preferred.
 */
export function sandboxPathHostToContainer(hostHomeDir: string, userId: string, targetPath: string): string {
    if (!path.isAbsolute(targetPath)) {
        return targetPath;
    }

    const resolvedHomeDir = path.resolve(hostHomeDir);
    const resolvedTargetPath = path.resolve(targetPath);
    const relativePath = path.relative(resolvedHomeDir, resolvedTargetPath);

    if (relativePath.startsWith("..") || relativePath === "") {
        if (relativePath === "") {
            return path.posix.join("/home", userId);
        }
        return targetPath;
    }

    const containerHomeDir = path.posix.join("/home", userId);
    const containerRelativePath = relativePath.split(path.sep).join(path.posix.sep);
    return path.posix.join(containerHomeDir, containerRelativePath);
}
