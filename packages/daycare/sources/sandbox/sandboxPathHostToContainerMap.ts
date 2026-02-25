import { pathMountMapHostToMapped } from "../util/pathMountMapHostToMapped.js";

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
    const mountPoints = [
        { hostPath: hostHomeDir, mappedPath: "/home" },
        ...(hostSkillsActiveDir ? [{ hostPath: hostSkillsActiveDir, mappedPath: "/shared/skills" }] : []),
        ...(hostExamplesDir ? [{ hostPath: hostExamplesDir, mappedPath: "/shared/examples" }] : [])
    ];
    return pathMountMapHostToMapped({ mountPoints, hostPath: targetPath });
}
