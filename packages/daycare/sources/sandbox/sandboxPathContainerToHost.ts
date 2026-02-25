import { sandboxPathContainerToHostMap } from "./sandboxPathContainerToHostMap.js";

/**
 * Rewrites a container /home/<userId> path into its host mounted home directory path.
 * Returns null when targetPath is not mappable to a configured mount.
 * Expects: targetPath uses POSIX separators when provided as a container path.
 */
export function sandboxPathContainerToHost(
    hostHomeDir: string,
    _userId: string,
    targetPath: string,
    hostSkillsActiveDir?: string,
    hostExamplesDir?: string
): string | null {
    return sandboxPathContainerToHostMap(hostHomeDir, targetPath, hostSkillsActiveDir, hostExamplesDir);
}
