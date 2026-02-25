import path from "node:path";

import type { PathMountPoint } from "./pathMountTypes.js";

export type PathMountMapMappedToHostInput = {
    mountPoints: PathMountPoint[];
    mappedPath: string;
};

/**
 * Maps a mapped absolute POSIX path into a host absolute path using mount points.
 * Returns null when the mapped path is relative or outside all mounts.
 * Expects: mount host paths are absolute host paths; mapped paths are absolute POSIX paths.
 */
export function pathMountMapMappedToHost(input: PathMountMapMappedToHostInput): string | null {
    if (!path.posix.isAbsolute(input.mappedPath)) {
        return null;
    }

    const targetPath = path.posix.normalize(input.mappedPath);
    let bestMatch: { length: number; hostPath: string } | null = null;

    for (const mountPoint of input.mountPoints) {
        if (!path.isAbsolute(mountPoint.hostPath)) {
            throw new Error(`Mount hostPath must be absolute: ${mountPoint.hostPath}`);
        }
        if (!path.posix.isAbsolute(mountPoint.mappedPath)) {
            throw new Error(`Mount mappedPath must be absolute POSIX path: ${mountPoint.mappedPath}`);
        }

        const hostRoot = path.resolve(mountPoint.hostPath);
        const mappedRoot = path.posix.normalize(mountPoint.mappedPath);
        const relativePath = path.posix.relative(mappedRoot, targetPath);
        if (relativePath.startsWith("..") || path.posix.isAbsolute(relativePath)) {
            continue;
        }

        const hostPath = relativePath.length === 0 ? hostRoot : path.resolve(hostRoot, ...relativePath.split("/"));
        const candidate = { length: mappedRoot.length, hostPath };
        if (!bestMatch || candidate.length > bestMatch.length) {
            bestMatch = candidate;
        }
    }

    return bestMatch?.hostPath ?? null;
}
