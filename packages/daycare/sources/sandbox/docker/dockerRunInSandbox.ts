import path from "node:path";

import { getLogger } from "../../log.js";
import { pathMountMapHostToMapped } from "../../utils/pathMountMapHostToMapped.js";
import type { PathMountPoint } from "../../utils/pathMountTypes.js";
import { sandboxHomeRedefine } from "../sandboxHomeRedefine.js";
import { dockerContainersShared } from "./dockerContainersShared.js";
import type { DockerContainerConfig, DockerContainerExecResult } from "./dockerTypes.js";

const logger = getLogger("sandbox.docker");
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_BUFFER_BYTES = 1_000_000;

export type DockerRunInSandboxOptions = {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    home: string;
    timeoutMs?: number;
    maxBufferBytes?: number;
    signal?: AbortSignal;
    docker: Omit<DockerContainerConfig, "hostHomeDir"> & {
        mounts: PathMountPoint[];
    };
};

/**
 * Runs a command directly inside a per-user Docker container.
 * Expects: docker image is local and options.home is mounted to /home.
 */
export async function dockerRunInSandbox(
    command: string,
    options: DockerRunInSandboxOptions
): Promise<{ stdout: string; stderr: string }> {
    const hostHomeDir = path.resolve(options.home);
    const mounts = options.docker.mounts;
    const dockerConfig: DockerContainerConfig = {
        ...options.docker,
        hostHomeDir,
        mounts
    };
    const { env } = await sandboxHomeRedefine({
        env: options.env ?? process.env,
        home: hostHomeDir
    });
    const containerEnv = dockerTmpEnvNormalize(envPathRewrite(env, mounts));
    const containerCwd = options.cwd ? containerPathRewriteStrict(options.cwd, mounts) : undefined;
    logger.debug(`exec: running in docker cwd=${containerCwd} command=${JSON.stringify(command)}`);
    const result = await dockerContainersShared.exec(dockerConfig, {
        command: ["bash", "-lc", command],
        cwd: containerCwd,
        env: containerEnv,
        timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        maxBufferBytes: options.maxBufferBytes ?? DEFAULT_MAX_BUFFER_BYTES,
        signal: options.signal
    });

    logger.debug(`exec: completed exitCode=${result.exitCode}`);
    if (result.exitCode !== 0) {
        logger.warn(
            `exec: non-zero exit exitCode=${result.exitCode}` +
                (result.stderr ? ` stderr=${result.stderr.slice(0, 500)}` : "")
        );
        throw dockerExecErrorBuild(result);
    }

    return {
        stdout: result.stdout,
        stderr: result.stderr
    };
}

function envPathRewrite(env: NodeJS.ProcessEnv, mounts: PathMountPoint[]): NodeJS.ProcessEnv {
    const rewritten: NodeJS.ProcessEnv = {};

    for (const [key, value] of Object.entries(env)) {
        if (value === undefined) {
            continue;
        }
        rewritten[key] = containerPathRewrite(value, mounts);
    }

    return rewritten;
}

/**
 * Normalizes temp paths for Docker execution to avoid Chrome sandbox failures with /home/.tmp.
 * Expects: env has already been path-rewritten for container mounts.
 */
function dockerTmpEnvNormalize(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
    return {
        ...env,
        TMPDIR: "/tmp",
        TMP: "/tmp",
        TEMP: "/tmp"
    };
}

function containerPathRewrite(value: string, mounts: PathMountPoint[]): string {
    return pathMountMapHostToMapped({ mountPoints: mounts, hostPath: value }) ?? value;
}

function containerPathRewriteStrict(value: string, mounts: PathMountPoint[]): string {
    const mapped = pathMountMapHostToMapped({ mountPoints: mounts, hostPath: value });
    if (!mapped) {
        throw new Error(`Path is not mappable to container mounts: ${value}`);
    }
    return mapped;
}

function dockerExecErrorBuild(result: DockerContainerExecResult): Error & {
    stdout: string;
    stderr: string;
    code: number | null;
    signal: null;
} {
    const error = new Error(`docker exec failed with code ${result.exitCode ?? "unknown"}`) as Error & {
        stdout: string;
        stderr: string;
        code: number | null;
        signal: null;
    };
    error.stdout = result.stdout;
    error.stderr = result.stderr;
    error.code = result.exitCode;
    error.signal = null;
    return error;
}
