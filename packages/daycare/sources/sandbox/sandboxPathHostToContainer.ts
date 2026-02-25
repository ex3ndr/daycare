import { sandboxPathHostToContainerMap } from "./sandboxPathHostToContainerMap.js";

/**
 * Rewrites a host path under user home into its container /home/<userId> equivalent.
 * Returns null when targetPath is not mappable to a configured mount.
 * Expects: hostHomeDir is the host-side user home mount; absolute input paths are preferred.
 */
export function sandboxPathHostToContainer(
    hostHomeDir: string,
    _userId: string,
    targetPath: string,
    hostSkillsActiveDir?: string,
    hostExamplesDir?: string
): string | null {
    return sandboxPathHostToContainerMap(hostHomeDir, targetPath, hostSkillsActiveDir, hostExamplesDir);
}
