import { promises as fs } from "node:fs";
import path from "node:path";

import type { SandboxRuntimeConfig } from "@anthropic-ai/sandbox-runtime";

import { sandboxHomeRedefine } from "../sandboxHomeRedefine.js";
import { sandboxPathHostToContainer } from "../sandboxPathHostToContainer.js";
import { dockerContainersShared } from "./dockerContainersShared.js";
import type { DockerContainerConfig, DockerContainerExecResult } from "./dockerTypes.js";

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_BUFFER_BYTES = 1_000_000;

export type DockerRunInSandboxOptions = {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    home: string;
    timeoutMs?: number;
    maxBufferBytes?: number;
    docker: Omit<DockerContainerConfig, "hostHomeDir">;
};

/**
 * Runs sandbox-runtime inside a per-user Docker container.
 * Expects: docker image is local and options.home is mounted to /home/<userId>.
 */
export async function dockerRunInSandbox(
    command: string,
    config: SandboxRuntimeConfig,
    options: DockerRunInSandboxOptions
): Promise<{ stdout: string; stderr: string }> {
    const hostHomeDir = path.resolve(options.home);
    const dockerConfig: DockerContainerConfig = {
        ...options.docker,
        hostHomeDir
    };

    const runtimeConfig = runtimeConfigPathRewrite(config, hostHomeDir, options.docker.userId);
    const settingsHostPath = path.join(
        hostHomeDir,
        ".tmp",
        `daycare-srt-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.json`
    );
    const { env } = await sandboxHomeRedefine({
        env: options.env ?? process.env,
        home: hostHomeDir
    });
    const containerEnv = envPathRewrite(env, hostHomeDir, options.docker.userId);
    const containerCwd = options.cwd
        ? sandboxPathHostToContainer(hostHomeDir, options.docker.userId, options.cwd)
        : undefined;
    const settingsContainerPath = sandboxPathHostToContainer(hostHomeDir, options.docker.userId, settingsHostPath);

    await fs.mkdir(path.dirname(settingsHostPath), { recursive: true });
    await fs.writeFile(settingsHostPath, JSON.stringify(runtimeConfig), "utf8");

    try {
        const cliResolveResult = await dockerContainersShared.exec(dockerConfig, {
            command: ["node", "-p", "require.resolve('@anthropic-ai/sandbox-runtime/dist/cli.js')"],
            cwd: containerCwd,
            env: containerEnv,
            timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
            maxBufferBytes: options.maxBufferBytes ?? DEFAULT_MAX_BUFFER_BYTES
        });

        const srtCliPath = cliPathResolveFromResult(cliResolveResult);

        const result = await dockerContainersShared.exec(dockerConfig, {
            command: ["node", srtCliPath, "--settings", settingsContainerPath, "-c", command],
            cwd: containerCwd,
            env: containerEnv,
            timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
            maxBufferBytes: options.maxBufferBytes ?? DEFAULT_MAX_BUFFER_BYTES
        });

        if (result.exitCode !== 0) {
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
    config: SandboxRuntimeConfig,
    hostHomeDir: string,
    userId: string
): SandboxRuntimeConfig {
    if (!config.filesystem) {
        return config;
    }

    return {
        ...config,
        filesystem: {
            ...config.filesystem,
            allowWrite: config.filesystem.allowWrite.map((entry) =>
                sandboxPathHostToContainer(hostHomeDir, userId, entry)
            ),
            denyRead: config.filesystem.denyRead.map((entry) => sandboxPathHostToContainer(hostHomeDir, userId, entry)),
            denyWrite: config.filesystem.denyWrite.map((entry) =>
                sandboxPathHostToContainer(hostHomeDir, userId, entry)
            )
        }
    };
}

function envPathRewrite(env: NodeJS.ProcessEnv, hostHomeDir: string, userId: string): NodeJS.ProcessEnv {
    const rewritten: NodeJS.ProcessEnv = {};

    for (const [key, value] of Object.entries(env)) {
        if (value === undefined) {
            continue;
        }
        rewritten[key] = sandboxPathHostToContainer(hostHomeDir, userId, value);
    }

    return rewritten;
}

function cliPathResolveFromResult(result: DockerContainerExecResult): string {
    if (result.exitCode !== 0) {
        throw dockerExecErrorBuild(result);
    }

    const lines = result.stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

    const cliPath = lines.at(-1);
    if (!cliPath) {
        throw new Error("Failed to resolve sandbox-runtime CLI path inside Docker container.");
    }

    return cliPath;
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
