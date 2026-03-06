import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";

import { getLogger } from "../log.js";
import { sandboxHomeRedefine } from "./sandboxHomeRedefine.js";

const logger = getLogger("sandbox.runtime");
const execFile = promisify(execFileCallback);
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_BUFFER_BYTES = 1_000_000;

/**
 * Runs a command directly on the host without an inner sandbox.
 * Expects: command is non-empty.
 */
export async function runInSandbox(
    command: string,
    _config: Record<string, unknown>,
    options: {
        cwd?: string;
        env?: NodeJS.ProcessEnv;
        home?: string;
        timeoutMs?: number;
        maxBufferBytes?: number;
        signal?: AbortSignal;
    } = {}
): Promise<{ stdout: string; stderr: string }> {
    logger.debug("execute: Executing command without inner sandbox");
    const baseEnv = options.env ?? process.env;
    const { env } = await sandboxHomeRedefine({
        env: baseEnv,
        home: options.home
    });
    const result = await execFile("/bin/bash", ["-lc", command], {
        cwd: options.cwd,
        env,
        timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        maxBuffer: options.maxBufferBytes ?? DEFAULT_MAX_BUFFER_BYTES,
        encoding: "utf8",
        signal: options.signal
    });
    return {
        stdout: result.stdout,
        stderr: result.stderr
    };
}
