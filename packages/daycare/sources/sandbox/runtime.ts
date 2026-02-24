import { execFile as execFileCallback } from "node:child_process";
import { promises as fs } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { SandboxRuntimeConfig } from "@anthropic-ai/sandbox-runtime";

import { getLogger } from "../log.js";
import { sandboxDockerEnvironmentIs } from "./sandboxDockerEnvironmentIs.js";
import { sandboxHomeRedefine } from "./sandboxHomeRedefine.js";

const logger = getLogger("sandbox.runtime");
const nodeRequire = createRequire(import.meta.url);
const srtCliPath = nodeRequire.resolve("@anthropic-ai/sandbox-runtime/dist/cli.js");
const execFile = promisify(execFileCallback);
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_BUFFER_BYTES = 1_000_000;

/**
 * Runs a command with a per-call sandbox config.
 * Expects: command is non-empty and config is fully resolved for this execution.
 */
export async function runInSandbox(
    command: string,
    config: SandboxRuntimeConfig,
    options: {
        cwd?: string;
        env?: NodeJS.ProcessEnv;
        home?: string;
        timeoutMs?: number;
        maxBufferBytes?: number;
    } = {}
): Promise<{ stdout: string; stderr: string }> {
    const defaultEnableWeakerNestedSandbox = await sandboxDockerEnvironmentIs();
    const enableWeakerNestedSandbox =
        config.enableWeakerNestedSandbox ?? (defaultEnableWeakerNestedSandbox ? true : undefined);
    const runtimeConfig: SandboxRuntimeConfig = {
        ...config,
        ...(enableWeakerNestedSandbox === undefined ? {} : { enableWeakerNestedSandbox })
    };
    const settingsPath = path.join(
        os.tmpdir(),
        `claybot-srt-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.json`
    );
    await fs.writeFile(settingsPath, JSON.stringify(runtimeConfig), "utf8");
    logger.debug("execute: Executing command with sandbox config");
    try {
        const baseEnv = options.env ?? process.env;
        const { env } = await sandboxHomeRedefine({
            env: baseEnv,
            home: options.home
        });
        const result = await execFile(process.execPath, [srtCliPath, "--settings", settingsPath, "-c", command], {
            cwd: options.cwd,
            env,
            timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
            maxBuffer: options.maxBufferBytes ?? DEFAULT_MAX_BUFFER_BYTES,
            encoding: "utf8"
        });
        return {
            stdout: result.stdout,
            stderr: result.stderr
        };
    } finally {
        await fs.rm(settingsPath, { force: true });
    }
}
