import path from "node:path";

import type { PathMountPoint } from "./pathMountTypes.js";

export type PathMountMapHostToMappedInput = {
    mountPoints: PathMountPoint[];
    hostPath: string;
};

/**
 * Maps a host absolute path into a mapped absolute POSIX path using mount points.
 * Returns null when the host path is relative or outside all mounts.
 * Expects: mount host paths are absolute host paths; mapped paths are absolute POSIX paths.
 */
export function pathMountMapHostToMapped(input: PathMountMapHostToMappedInput): string | null {
    if (!path.isAbsolute(input.hostPath)) {
        return null;
    }

    const targetPath = path.resolve(input.hostPath);
    let bestMatch: { length: number; mappedPath: string } | null = null;

    for (const mountPoint of input.mountPoints) {
        if (!path.isAbsolute(mountPoint.hostPath)) {
            throw new Error(`Mount hostPath must be absolute: ${mountPoint.hostPath}`);
        }
        if (!path.posix.isAbsolute(mountPoint.mappedPath)) {
            throw new Error(`Mount mappedPath must be absolute POSIX path: ${mountPoint.mappedPath}`);
        }

        const hostRoot = path.resolve(mountPoint.hostPath);
        const mappedRoot = path.posix.normalize(mountPoint.mappedPath);
        const relativePath = path.relative(hostRoot, targetPath);
        if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
            continue;
        }

        const mappedPath =
            relativePath.length === 0
                ? mappedRoot
                : path.posix.join(mappedRoot, relativePath.split(path.sep).join(path.posix.sep));
        const candidate = { length: hostRoot.length, mappedPath };
        if (!bestMatch || candidate.length > bestMatch.length) {
            bestMatch = candidate;
        }
    }

    return bestMatch?.mappedPath ?? null;
}
