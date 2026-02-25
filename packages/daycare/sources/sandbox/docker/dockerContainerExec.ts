import type { Readable } from "node:stream";
import { PassThrough } from "node:stream";
import type Docker from "dockerode";

import type { DockerContainerExecArgs, DockerContainerExecResult } from "./dockerTypes.js";

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_BUFFER_BYTES = 1_000_000;

/**
 * Executes a command inside a running sandbox container via docker exec.
 * Expects: container is running and command is already tokenized as argv.
 */
export async function dockerContainerExec(
    docker: Docker,
    container: Docker.Container,
    args: DockerContainerExecArgs
): Promise<DockerContainerExecResult> {
    const exec = await container.exec({
        Cmd: args.command,
        AttachStdout: true,
        AttachStderr: true,
        WorkingDir: args.cwd,
        Env: dockerEnvBuild(args.env)
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    const maxBufferBytes = args.maxBufferBytes ?? DEFAULT_MAX_BUFFER_BYTES;
    const stdoutStream = new PassThrough();
    const stderrStream = new PassThrough();
    let streamError: Error | null = null;
    let outputStream: Readable | null = null;

    stdoutStream.on("data", (chunk) => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        stdoutChunks.push(buffer);
        if (totalBytes(stdoutChunks) <= maxBufferBytes) {
            return;
        }
        streamError = new Error(`stdout exceeded maxBufferBytes (${maxBufferBytes})`);
        outputStream?.destroy(streamError);
    });

    stderrStream.on("data", (chunk) => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        stderrChunks.push(buffer);
        if (totalBytes(stderrChunks) <= maxBufferBytes) {
            return;
        }
        streamError = new Error(`stderr exceeded maxBufferBytes (${maxBufferBytes})`);
        outputStream?.destroy(streamError);
    });

    outputStream = (await exec.start({
        hijack: true,
        stdin: false
    })) as Readable;
    docker.modem.demuxStream(outputStream, stdoutStream, stderrStream);
    if (typeof outputStream.resume === "function") {
        outputStream.resume();
    }

    await streamWait(outputStream, args.timeoutMs ?? DEFAULT_TIMEOUT_MS, args.signal);

    stdoutStream.end();
    stderrStream.end();

    if (streamError) {
        throw streamError;
    }

    const details = await exec.inspect();
    return {
        stdout: Buffer.concat(stdoutChunks).toString("utf8"),
        stderr: Buffer.concat(stderrChunks).toString("utf8"),
        exitCode: typeof details.ExitCode === "number" ? details.ExitCode : null
    };
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

async function streamWait(stream: Readable, timeoutMs: number, signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) {
        stream.destroy();
        throw abortErrorBuild();
    }

    await new Promise<void>((resolve, reject) => {
        let settled = false;
        const timer = setTimeout(() => {
            const timeoutError = new Error(`docker exec timed out after ${timeoutMs}ms`);
            stream.destroy(timeoutError);
        }, timeoutMs);
        const onAbort = () => {
            stream.destroy(abortErrorBuild());
        };
        signal?.addEventListener("abort", onAbort, { once: true });

        const cleanup = () => {
            if (settled) {
                return;
            }
            settled = true;
            clearTimeout(timer);
            signal?.removeEventListener("abort", onAbort);
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

function abortErrorBuild(): Error {
    const error = new Error("Operation aborted.");
    error.name = "AbortError";
    return error;
}
