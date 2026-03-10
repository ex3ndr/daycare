import type { Readable } from "node:stream";
import { PassThrough } from "node:stream";
import type Docker from "dockerode";

import type { SandboxExecSignal } from "../sandboxTypes.js";
import type { DockerContainerExecArgs, DockerContainerExecHandle, DockerContainerExecResult } from "./dockerTypes.js";

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_BUFFER_BYTES = 1_000_000;
const EXEC_PID_RETRY_DELAY_MS = 25;
const EXEC_PID_RETRY_COUNT = 40;

/**
 * Executes a command inside a running sandbox container via docker exec.
 * Expects: container is running and command is already tokenized as argv.
 */
export async function dockerContainerExec(
    docker: Docker,
    container: Docker.Container,
    args: DockerContainerExecArgs
): Promise<DockerContainerExecHandle> {
    const exec = await container.exec({
        Cmd: args.command,
        AttachStdout: true,
        AttachStderr: true,
        AttachStdin: args.closeStdinToKill === true,
        WorkingDir: args.cwd,
        Env: dockerEnvBuild(args.env)
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    const maxBufferBytes = args.maxBufferBytes ?? DEFAULT_MAX_BUFFER_BYTES;
    const stdoutStream = new PassThrough();
    const stderrStream = new PassThrough();
    let streamError: Error | null = null;
    let outputStream: (Readable & { end?: () => void; write?: (chunk: string) => boolean }) | null = null;
    let exitSignal: string | null = null;
    let timeoutError: Error | null = null;
    let abortedError: Error | null = null;
    let finished = false;
    let pidResolved = false;
    let pidValue: number | null = null;
    let pidPromise: Promise<number | null> = Promise.resolve(null);

    stdoutStream.on("data", (chunk) => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        stdoutChunks.push(buffer);
        if (totalBytes(stdoutChunks) <= maxBufferBytes) {
            return;
        }
        streamError = new Error(`stdout exceeded maxBufferBytes (${maxBufferBytes})`);
        void stopProcess("SIGKILL");
        outputStream?.destroy(streamError);
    });

    stderrStream.on("data", (chunk) => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        stderrChunks.push(buffer);
        if (totalBytes(stderrChunks) <= maxBufferBytes) {
            return;
        }
        streamError = new Error(`stderr exceeded maxBufferBytes (${maxBufferBytes})`);
        void stopProcess("SIGKILL");
        outputStream?.destroy(streamError);
    });

    outputStream = (await exec.start({
        hijack: true,
        stdin: args.closeStdinToKill === true
    })) as Readable & { end?: () => void; write?: (chunk: string) => boolean };
    const stream = outputStream;
    docker.modem.demuxStream(stream, stdoutStream, stderrStream);
    if (typeof stream.resume === "function") {
        stream.resume();
    }

    pidPromise = execPidResolve(exec);
    const onAbort = () => {
        abortedError = abortErrorBuild();
        void stopProcess("SIGTERM");
    };
    if (args.signal?.aborted) {
        onAbort();
    } else {
        args.signal?.addEventListener("abort", onAbort, { once: true });
    }

    const waitPromise = (async (): Promise<DockerContainerExecResult> => {
        const timeoutMs = args.timeoutMs ?? DEFAULT_TIMEOUT_MS;
        try {
            await streamWait(stream, timeoutMs, async () => {
                timeoutError = new Error(`docker exec timed out after ${timeoutMs}ms`);
                await stopProcess("SIGKILL");
                stream.destroy(timeoutError);
            });
        } finally {
            finished = true;
            args.signal?.removeEventListener("abort", onAbort);
            stdoutStream.end();
            stderrStream.end();
        }

        if (streamError) {
            throw streamError;
        }
        if (timeoutError) {
            throw timeoutError;
        }
        if (abortedError) {
            throw abortedError;
        }

        const details = await execResultResolve(exec);
        return {
            stdout: Buffer.concat(stdoutChunks).toString("utf8"),
            stderr: Buffer.concat(stderrChunks).toString("utf8"),
            exitCode: typeof details.ExitCode === "number" ? details.ExitCode : null,
            signal: exitSignal
        };
    })();

    return {
        stdout: stdoutStream,
        stderr: stderrStream,
        wait: () => waitPromise,
        kill: async (signal = "SIGTERM") => {
            await stopProcess(signal);
        }
    };

    async function stopProcess(signal: SandboxExecSignal): Promise<void> {
        if (finished) {
            return;
        }
        exitSignal = signal;
        if (args.processTreeControlFile) {
            await dockerProcessTreeSignal(container, signal, args.processTreeControlFile);
            return;
        }
        const pid = await pidPromise;
        await dockerProcessTreeKill(container, signal, {
            pid,
            pidFile: args.processTreePidFile
        });
    }

    async function execPidResolve(execHandle: Docker.Exec): Promise<number | null> {
        if (pidResolved) {
            return pidValue;
        }

        for (let attempt = 0; attempt < EXEC_PID_RETRY_COUNT; attempt += 1) {
            const details = await execHandle.inspect();
            if (typeof details.Pid === "number" && details.Pid > 0) {
                pidResolved = true;
                pidValue = details.Pid;
                return pidValue;
            }
            if (details.Running === false) {
                break;
            }
            await sleep(EXEC_PID_RETRY_DELAY_MS);
        }

        pidResolved = true;
        pidValue = null;
        return null;
    }

    async function execResultResolve(execHandle: Docker.Exec): Promise<{ ExitCode?: number | null }> {
        for (let attempt = 0; attempt < EXEC_PID_RETRY_COUNT; attempt += 1) {
            const details = await execHandle.inspect();
            if (typeof details.ExitCode === "number" || details.Running === false) {
                return details;
            }
            await sleep(EXEC_PID_RETRY_DELAY_MS);
        }
        return execHandle.inspect();
    }
}

function dockerEnvBuild(env?: NodeJS.ProcessEnv): string[] | undefined {
    if (!env) {
        return undefined;
    }

    const entries = Object.entries(env)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => `${key}=${value}`);

    if (entries.length === 0) {
        return undefined;
    }

    return entries;
}

function totalBytes(chunks: Buffer[]): number {
    return chunks.reduce((acc, chunk) => acc + chunk.length, 0);
}

async function streamWait(stream: Readable, timeoutMs: number, onTimeout: () => Promise<void>): Promise<void> {
    await new Promise<void>((resolve, reject) => {
        let settled = false;
        const timer = setTimeout(() => {
            void onTimeout().catch(reject);
        }, timeoutMs);

        const cleanup = () => {
            if (settled) {
                return;
            }
            settled = true;
            clearTimeout(timer);
            stream.removeListener("end", onDone);
            stream.removeListener("close", onDone);
            stream.removeListener("finish", onDone);
            stream.removeListener("error", onError);
        };

        const onDone = () => {
            cleanup();
            resolve();
        };

        const onError = (error: Error) => {
            cleanup();
            reject(error);
        };

        stream.on("end", onDone);
        stream.on("close", onDone);
        stream.on("finish", onDone);
        stream.on("error", onError);
    });
}

async function dockerProcessTreeKill(
    container: Docker.Container,
    signal: SandboxExecSignal,
    target: {
        pid: number | null;
        pidFile?: string;
    }
): Promise<void> {
    const signalName = signal.replace(/^SIG/, "");
    const pidResolveSnippet = target.pidFile
        ? `if [ -f ${shellEscape(target.pidFile)} ]; then target_pid="$(cat ${shellEscape(target.pidFile)})"; elif [ -n "${target.pid ?? ""}" ]; then target_pid="${target.pid}"; fi;`
        : `target_pid="${target.pid ?? ""}";`;
    const killCommand = [
        'target_pid="";',
        pidResolveSnippet,
        'if [ -z "$target_pid" ]; then exit 0; fi;',
        "kill_tree() {",
        '  local target="$1";',
        "  local child;",
        '  for child in $(pgrep -P "$target" 2>/dev/null || true); do',
        `    kill_tree "$child";`,
        "  done;",
        `  kill -${signalName} -- -"$target" 2>/dev/null || true;`,
        `  kill -${signalName} "$target" 2>/dev/null || true;`,
        "}",
        'kill_tree "$target_pid"'
    ].join(" ");
    const exec = await container.exec({
        Cmd: ["bash", "-lc", killCommand],
        AttachStdout: true,
        AttachStderr: true
    });
    const stream = (await exec.start({
        hijack: true,
        stdin: false
    })) as Readable;
    stream.resume();
    await new Promise<void>((resolve, reject) => {
        stream.once("end", resolve);
        stream.once("close", resolve);
        stream.once("finish", resolve);
        stream.once("error", reject);
    });
}

async function dockerProcessTreeSignal(
    container: Docker.Container,
    signal: SandboxExecSignal,
    controlFile: string
): Promise<void> {
    const exec = await container.exec({
        Cmd: ["bash", "-lc", `printf '%s\\n' '${signal}' > ${shellEscape(controlFile)} 2>/dev/null || true`],
        AttachStdout: true,
        AttachStderr: true
    });
    const stream = (await exec.start({
        hijack: true,
        stdin: false
    })) as Readable;
    stream.resume();
    await new Promise<void>((resolve, reject) => {
        stream.once("end", resolve);
        stream.once("close", resolve);
        stream.once("finish", resolve);
        stream.once("error", reject);
    });
}

function shellEscape(value: string): string {
    return `'${value.replaceAll("'", `'"'"'`)}'`;
}

async function sleep(ms: number): Promise<void> {
    await new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

function abortErrorBuild(): Error {
    const error = new Error("Operation aborted.");
    error.name = "AbortError";
    return error;
}
