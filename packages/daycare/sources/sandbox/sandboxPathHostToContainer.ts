import { sandboxPathHostToContainerMap } from "../util/sandboxPathHostToContainerMap.js";

/**
 * Rewrites a host path under user home into its container /home/<userId> equivalent.
 * Expects: hostHomeDir is the host-side user home mount; absolute input paths are preferred.
 */
export function sandboxPathHostToContainer(
    hostHomeDir: string,
    _userId: string,
    targetPath: string,
    hostSkillsActiveDir?: string,
    hostExamplesDir?: string
): string {
    return sandboxPathHostToContainerMap(hostHomeDir, targetPath, hostSkillsActiveDir, hostExamplesDir) ?? targetPath;
}
