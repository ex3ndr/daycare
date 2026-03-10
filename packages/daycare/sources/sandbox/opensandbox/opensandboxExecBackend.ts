import { PassThrough } from "node:stream";
import type { CommandExecution } from "@alibaba-group/opensandbox";

import { getLogger } from "../../log.js";
import type { PathMountPoint } from "../../utils/pathMountTypes.js";
import type {
    SandboxExecBackend,
    SandboxExecBackendArgs,
    SandboxExecBackendHandle,
    SandboxExecBackendResult
} from "../sandboxExecBackendTypes.js";
import { sandboxExecRuntimeArgsBuild } from "../sandboxExecRuntimeArgsBuild.js";
import type { SandboxExecSignal, SandboxOpenSandboxConfig } from "../sandboxTypes.js";
import { opensandboxCommandBuild } from "./opensandboxCommandBuild.js";
import { opensandboxSandboxEnsure } from "./opensandboxSandboxEnsure.js";

const logger = getLogger("sandbox.opensandbox");

export class OpenSandboxExecBackend implements SandboxExecBackend {
    private readonly config: SandboxOpenSandboxConfig;
    private readonly mounts: PathMountPoint[];

    constructor(config: SandboxOpenSandboxConfig, mounts: PathMountPoint[]) {
        this.config = config;
        this.mounts = mounts;
    }

    async exec(args: SandboxExecBackendArgs): Promise<SandboxExecBackendHandle> {
        const runtimeArgs = sandboxExecRuntimeArgsBuild({
            env: args.env,
            cwd: args.cwd,
            mounts: this.mounts
        });
        const sandbox = await opensandboxSandboxEnsure(this.config, this.mounts);
        const stdoutChunks: Buffer[] = [];
        const stderrChunks: Buffer[] = [];
        const stdout = new PassThrough();
        const stderr = new PassThrough();
        const controller = new AbortController();
        let commandId: string | null = null;
        let exitSignal: string | null = null;
        let abortedError: Error | null = null;
        let manualInterrupted = false;

        const onAbort = () => {
            abortedError = abortErrorBuild();
            void interruptExecution("SIGTERM", true);
        };
        if (args.signal?.aborted) {
            onAbort();
        } else {
            args.signal?.addEventListener("abort", onAbort, { once: true });
        }

        const waitPromise = (async (): Promise<SandboxExecBackendResult> => {
            try {
                const execution = await sandbox.commands.run(
                    opensandboxCommandBuild({
                        command: args.command,
                        env: runtimeArgs.env
                    }),
                    {
                        workingDirectory: runtimeArgs.cwd,
                        timeoutSeconds: Math.max(1, Math.ceil(args.timeoutMs / 1000))
                    },
                    {
                        onInit: (message) => {
                            commandId = message.id || null;
                            if (manualInterrupted && commandId) {
                                return sandbox.commands.interrupt(commandId);
                            }
                        },
                        onStdout: (message) => {
                            try {
                                outputAppend(stdoutChunks, message.text, args.maxBufferBytes, "stdout");
                            } catch (error) {
                                void interruptExecution("SIGKILL", false);
                                throw error;
                            }
                            stdout.write(message.text);
                        },
                        onStderr: (message) => {
                            try {
                                outputAppend(stderrChunks, message.text, args.maxBufferBytes, "stderr");
                            } catch (error) {
                                void interruptExecution("SIGKILL", false);
                                throw error;
                            }
                            stderr.write(message.text);
                        }
                    },
                    controller.signal
                );

                if (abortedError) {
                    throw abortedError;
                }

                return await opensandboxResultBuild(sandbox, execution, stdoutChunks, stderrChunks, exitSignal);
            } catch (error) {
                if (abortedError) {
                    throw abortedError;
                }
                if (manualInterrupted && abortErrorIs(error)) {
                    return {
                        stdout: Buffer.concat(stdoutChunks).toString("utf8"),
                        stderr: Buffer.concat(stderrChunks).toString("utf8"),
                        exitCode: null,
                        signal: exitSignal
                    };
                }
                throw error;
            } finally {
                args.signal?.removeEventListener("abort", onAbort);
                stdout.end();
                stderr.end();
            }
        })();

        return {
            stdout,
            stderr,
            wait: () => waitPromise,
            kill: async (signal = "SIGTERM") => {
                await interruptExecution(signal, false);
            }
        };

        async function interruptExecution(signal: SandboxExecSignal, fromAbortSignal: boolean): Promise<void> {
            exitSignal = signal;
            if (!fromAbortSignal) {
                manualInterrupted = true;
            }
            if (commandId) {
                await sandbox.commands.interrupt(commandId);
                return;
            }
            controller.abort(abortErrorBuild());
        }
    }
}

function opensandboxExitCodeResolve(execution: CommandExecution): number | null {
    if (execution.error) {
        return 1;
    }
    return 0;
}

function outputAppend(chunks: Buffer[], text: string, maxBufferBytes: number, streamName: "stdout" | "stderr"): void {
    const buffer = Buffer.from(text, "utf8");
    chunks.push(buffer);
    const totalBytes = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    if (totalBytes <= maxBufferBytes) {
        return;
    }
    throw opensandboxMaxBufferErrorBuild(chunks, maxBufferBytes, streamName);
}

function opensandboxMaxBufferErrorBuild(
    chunks: Buffer[],
    maxBufferBytes: number,
    streamName: "stdout" | "stderr"
): Error & { stdout?: string; stderr?: string; code: null; signal: null } {
    const error = new Error(`${streamName} exceeded maxBufferBytes (${maxBufferBytes})`) as Error & {
        stdout?: string;
        stderr?: string;
        code: null;
        signal: null;
    };
    const output = Buffer.concat(chunks).toString("utf8");
    error[streamName] = output;
    error.code = null;
    error.signal = null;
    return error;
}

async function opensandboxResultBuild(
    sandbox: Awaited<ReturnType<typeof opensandboxSandboxEnsure>>,
    execution: CommandExecution,
    stdoutChunks: Buffer[],
    stderrChunks: Buffer[],
    signal: string | null
): Promise<SandboxExecBackendResult> {
    const status = execution.id ? await sandbox.commands.getCommandStatus(execution.id) : undefined;
    const stdout = Buffer.concat(stdoutChunks).toString("utf8");
    let stderr = Buffer.concat(stderrChunks).toString("utf8");
    const fallbackError = status?.error ?? execution.error?.value;
    if (fallbackError && !stderr.includes(fallbackError)) {
        stderr = stderr ? `${stderr}\n${fallbackError}` : fallbackError;
    }
    const exitCode = typeof status?.exitCode === "number" ? status.exitCode : opensandboxExitCodeResolve(execution);

    logger.debug(`exec: completed exitCode=${exitCode} signal=${signal ?? "none"}`);
    return {
        stdout,
        stderr,
        exitCode,
        signal
    };
}

function abortErrorBuild(): Error {
    const error = new Error("Operation aborted.");
    error.name = "AbortError";
    return error;
}

function abortErrorIs(error: unknown): boolean {
    return error instanceof Error && error.name === "AbortError";
}
