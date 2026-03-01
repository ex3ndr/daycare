import { promises as fs } from "node:fs";
import path from "node:path";

import type { SandboxRuntimeConfig } from "@anthropic-ai/sandbox-runtime";

import { getLogger } from "../../log.js";
import { pathMountMapHostToMapped } from "../../util/pathMountMapHostToMapped.js";
import type { PathMountPoint } from "../../util/pathMountTypes.js";
import { shellQuote } from "../../util/shellQuote.js";
import { sandboxHomeRedefine } from "../sandboxHomeRedefine.js";
import { dockerContainersShared } from "./dockerContainersShared.js";
import type { DockerContainerConfig, DockerContainerExecResult } from "./dockerTypes.js";

const logger = getLogger("sandbox.docker");
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_BUFFER_BYTES = 1_000_000;
const SANDBOX_CONTAINER_PATH = "/usr/local/bin/sandbox";

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

type SandboxRuntimeConfigWithOptionalGlobalNetwork = Omit<SandboxRuntimeConfig, "network"> & {
    network: Omit<SandboxRuntimeConfig["network"], "allowedDomains"> & {
        allowedDomains?: string[];
    };
};

/**
 * Runs sandbox-runtime inside a per-user Docker container.
 * Expects: docker image is local and options.home is mounted to /home.
 */
export async function dockerRunInSandbox(
    command: string,
    config: SandboxRuntimeConfigWithOptionalGlobalNetwork,
    options: DockerRunInSandboxOptions
): Promise<{ stdout: string; stderr: string }> {
    const hostHomeDir = path.resolve(options.home);
    const mounts = options.docker.mounts;
    const dockerConfig: DockerContainerConfig = {
        ...options.docker,
        hostHomeDir,
        mounts
    };

    const runtimeConfig = runtimeConfigPathRewrite(config, mounts);
    const settingsHostPath = path.join(
        hostHomeDir,
        ".tmp",
        `daycare-srt-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.json`
    );
    const { env } = await sandboxHomeRedefine({
        env: options.env ?? process.env,
        home: hostHomeDir
    });
    const containerEnv = dockerTmpEnvNormalize(envPathRewrite(env, mounts));
    const containerCwd = options.cwd ? containerPathRewriteStrict(options.cwd, mounts) : undefined;
    const settingsContainerPath = pathMountMapHostToMapped({ mountPoints: mounts, hostPath: settingsHostPath });
    if (!settingsContainerPath) {
        throw new Error(`Path is not mappable to container mounts: ${settingsHostPath}`);
    }

    await fs.mkdir(path.dirname(settingsHostPath), { recursive: true });
    await fs.writeFile(settingsHostPath, JSON.stringify(runtimeConfig), "utf8");

    try {
        logger.debug(
            `exec: running sandbox path=${SANDBOX_CONTAINER_PATH} cwd=${containerCwd} command=${JSON.stringify(command)}`
        );

        const result = await dockerContainersShared.exec(dockerConfig, {
            command: [
                "bash",
                "-lc",
                `${SANDBOX_CONTAINER_PATH} --settings ${settingsContainerPath} -- ${shellQuote(command)}`
            ],
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
    } finally {
        await fs.rm(settingsHostPath, { force: true });
    }
}

function runtimeConfigPathRewrite(
    config: SandboxRuntimeConfigWithOptionalGlobalNetwork,
    mounts: PathMountPoint[]
): SandboxRuntimeConfigWithOptionalGlobalNetwork {
    if (!config.filesystem) {
        return config;
    }

    const allowWrite = Array.from(
        new Set([
            ...config.filesystem.allowWrite.map((entry) => containerPathRewrite(entry, mounts)),
            "/tmp",
            "/run",
            "/var/tmp",
            "/home/.tmp"
        ])
    );

    return {
        ...config,
        filesystem: {
            ...config.filesystem,
            allowWrite,
            denyRead: config.filesystem.denyRead.map((entry) => containerPathRewrite(entry, mounts)),
            denyWrite: config.filesystem.denyWrite.map((entry) => containerPathRewrite(entry, mounts))
        }
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
