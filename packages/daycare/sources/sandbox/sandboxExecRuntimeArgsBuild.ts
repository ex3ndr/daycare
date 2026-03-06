import { pathMountMapHostToMapped } from "../utils/pathMountMapHostToMapped.js";
import type { PathMountPoint } from "../utils/pathMountTypes.js";

type SandboxExecRuntimeArgsBuildInput = {
    env: NodeJS.ProcessEnv;
    cwd?: string;
    mounts: PathMountPoint[];
};

type SandboxExecRuntimeArgs = {
    env: NodeJS.ProcessEnv;
    cwd?: string;
};

/**
 * Rewrites host-backed exec inputs into sandbox-visible paths.
 * Expects: cwd is already resolved on the host and every mounted path is declared in mounts.
 */
export function sandboxExecRuntimeArgsBuild(input: SandboxExecRuntimeArgsBuildInput): SandboxExecRuntimeArgs {
    const env: NodeJS.ProcessEnv = {};
    for (const [key, value] of Object.entries(input.env)) {
        if (value === undefined) {
            continue;
        }
        env[key] = pathMountMapHostToMapped({ mountPoints: input.mounts, hostPath: value }) ?? value;
    }

    env.TMPDIR = "/tmp";
    env.TMP = "/tmp";
    env.TEMP = "/tmp";

    if (!input.cwd) {
        return { env };
    }

    const cwd = pathMountMapHostToMapped({ mountPoints: input.mounts, hostPath: input.cwd });
    if (!cwd) {
        throw new Error(`Path is not mappable to sandbox mounts: ${input.cwd}`);
    }

    return {
        env,
        cwd
    };
}
