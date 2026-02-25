import { sandboxPathContainerToHostMap } from "../util/sandboxPathContainerToHostMap.js";

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
    return sandboxPathContainerToHostMap(hostHomeDir, targetPath, hostSkillsActiveDir, hostExamplesDir) ?? targetPath;
}
