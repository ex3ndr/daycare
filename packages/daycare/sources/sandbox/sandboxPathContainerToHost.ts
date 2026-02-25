import { sandboxPathContainerToHostMap } from "./sandboxPathContainerToHostMap.js";

type SandboxPathContainerToHostArgs = {
    hostHomeDir: string;
    targetPath: string;
    hostSkillsActiveDir?: string;
    hostExamplesDir?: string;
};

/**
 * Rewrites a container /home/<userId> path into its host mounted home directory path.
 * Returns null when targetPath is not mappable to a configured mount.
 * Expects: targetPath uses POSIX separators when provided as a container path.
 */
export function sandboxPathContainerToHost(args: SandboxPathContainerToHostArgs): string | null {
    return sandboxPathContainerToHostMap(
        args.hostHomeDir,
        args.targetPath,
        args.hostSkillsActiveDir,
        args.hostExamplesDir
    );
}
