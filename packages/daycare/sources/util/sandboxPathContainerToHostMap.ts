import { pathMountMapMappedToHost } from "./pathMountMapMappedToHost.js";

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
    const mountPoints = [
        { hostPath: hostHomeDir, mappedPath: "/home" },
        ...(hostSkillsActiveDir ? [{ hostPath: hostSkillsActiveDir, mappedPath: "/shared/skills" }] : []),
        ...(hostExamplesDir ? [{ hostPath: hostExamplesDir, mappedPath: "/shared/examples" }] : [])
    ];
    return pathMountMapMappedToHost({ mountPoints, mappedPath: targetPath });
}
