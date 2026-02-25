import { promises as fs } from "node:fs";
import path from "node:path";

import type { SandboxRuntimeConfig } from "@anthropic-ai/sandbox-runtime";

import { getLogger } from "../../log.js";
import { shellQuote } from "../../util/shellQuote.js";
import { sandboxHomeRedefine } from "../sandboxHomeRedefine.js";
import { sandboxPathHostToContainer } from "../sandboxPathHostToContainer.js";
import { dockerContainersShared } from "./dockerContainersShared.js";
import type { DockerContainerConfig, DockerContainerExecResult } from "./dockerTypes.js";

const logger = getLogger("sandbox.docker");
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_BUFFER_BYTES = 1_000_000;
const SRT_CONTAINER_PATH = "/usr/local/bin/srt";

export type DockerRunInSandboxOptions = {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    home: string;
    timeoutMs?: number;
    maxBufferBytes?: number;
    signal?: AbortSignal;
    docker: Omit<DockerContainerConfig, "hostHomeDir" | "hostSkillsActiveDir" | "hostExamplesDir"> & {
        hostSkillsActiveDir: string;
        hostExamplesDir: string;
    };
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
        hostHomeDir,
        hostSkillsActiveDir: path.resolve(options.docker.hostSkillsActiveDir),
        hostExamplesDir: path.resolve(options.docker.hostExamplesDir)
    };

    const runtimeConfig = runtimeConfigPathRewrite(
        config,
        hostHomeDir,
        options.docker.userId,
        dockerConfig.hostSkillsActiveDir,
        dockerConfig.hostExamplesDir
    );
    const settingsHostPath = path.join(
        hostHomeDir,
        ".tmp",
        `daycare-srt-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.json`
    );
    const { env } = await sandboxHomeRedefine({
        env: options.env ?? process.env,
        home: hostHomeDir
    });
    const containerEnv = envPathRewrite(
        env,
        hostHomeDir,
        options.docker.userId,
        dockerConfig.hostSkillsActiveDir,
        dockerConfig.hostExamplesDir
    );
    const containerCwd = options.cwd
        ? containerPathRewriteStrict(
              options.cwd,
              hostHomeDir,
              options.docker.userId,
              dockerConfig.hostSkillsActiveDir,
              dockerConfig.hostExamplesDir
          )
        : undefined;
    const settingsContainerPath = sandboxPathHostToContainer(
        hostHomeDir,
        options.docker.userId,
        settingsHostPath,
        dockerConfig.hostSkillsActiveDir,
        dockerConfig.hostExamplesDir
    );
    if (!settingsContainerPath) {
        throw new Error(`Path is not mappable to container mounts: ${settingsHostPath}`);
    }

    await fs.mkdir(path.dirname(settingsHostPath), { recursive: true });
    await fs.writeFile(settingsHostPath, JSON.stringify(runtimeConfig), "utf8");

    try {
        logger.debug(
            `exec: running srt path=${SRT_CONTAINER_PATH} cwd=${containerCwd} command=${JSON.stringify(command)}`
        );

        const result = await dockerContainersShared.exec(dockerConfig, {
            command: [
                "bash",
                "-lc",
                `${SRT_CONTAINER_PATH} --settings ${settingsContainerPath} -c ${shellQuote(command)}`
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
    config: SandboxRuntimeConfig,
    hostHomeDir: string,
    userId: string,
    hostSkillsActiveDir: string,
    hostExamplesDir: string
): SandboxRuntimeConfig {
    if (!config.filesystem) {
        return config;
    }

    return {
        ...config,
        filesystem: {
            ...config.filesystem,
            allowWrite: config.filesystem.allowWrite.map((entry) =>
                containerPathRewrite(entry, hostHomeDir, userId, hostSkillsActiveDir, hostExamplesDir)
            ),
            denyRead: config.filesystem.denyRead.map((entry) =>
                containerPathRewrite(entry, hostHomeDir, userId, hostSkillsActiveDir, hostExamplesDir)
            ),
            denyWrite: config.filesystem.denyWrite.map((entry) =>
                containerPathRewrite(entry, hostHomeDir, userId, hostSkillsActiveDir, hostExamplesDir)
            )
        }
    };
}

function envPathRewrite(
    env: NodeJS.ProcessEnv,
    hostHomeDir: string,
    userId: string,
    hostSkillsActiveDir: string,
    hostExamplesDir: string
): NodeJS.ProcessEnv {
    const rewritten: NodeJS.ProcessEnv = {};

    for (const [key, value] of Object.entries(env)) {
        if (value === undefined) {
            continue;
        }
        rewritten[key] = containerPathRewrite(value, hostHomeDir, userId, hostSkillsActiveDir, hostExamplesDir);
    }

    return rewritten;
}

function containerPathRewrite(
    value: string,
    hostHomeDir: string,
    userId: string,
    hostSkillsActiveDir: string,
    hostExamplesDir: string
): string {
    return sandboxPathHostToContainer(hostHomeDir, userId, value, hostSkillsActiveDir, hostExamplesDir) ?? value;
}

function containerPathRewriteStrict(
    value: string,
    hostHomeDir: string,
    userId: string,
    hostSkillsActiveDir: string,
    hostExamplesDir: string
): string {
    const mapped = sandboxPathHostToContainer(hostHomeDir, userId, value, hostSkillsActiveDir, hostExamplesDir);
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
