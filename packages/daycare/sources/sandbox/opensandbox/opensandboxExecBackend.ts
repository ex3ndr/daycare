import type { CommandExecution } from "@alibaba-group/opensandbox";

import { getLogger } from "../../log.js";
import type { PathMountPoint } from "../../utils/pathMountTypes.js";
import type {
    SandboxExecBackend,
    SandboxExecBackendArgs,
    SandboxExecBackendResult
} from "../sandboxExecBackendTypes.js";
import { sandboxExecRuntimeArgsBuild } from "../sandboxExecRuntimeArgsBuild.js";
import type { SandboxOpenSandboxConfig } from "../sandboxTypes.js";
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

    async exec(args: SandboxExecBackendArgs): Promise<SandboxExecBackendResult> {
        const runtimeArgs = sandboxExecRuntimeArgsBuild({
            env: args.env,
            cwd: args.cwd,
            mounts: this.mounts
        });
        const sandbox = await opensandboxSandboxEnsure(this.config, this.mounts);
        const stdoutChunks: Buffer[] = [];
        const stderrChunks: Buffer[] = [];
        const signal = abortSignalForward(args.signal);

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
                    onStdout: (message) => {
                        outputAppend(stdoutChunks, message.text, args.maxBufferBytes, "stdout");
                    },
                    onStderr: (message) => {
                        outputAppend(stderrChunks, message.text, args.maxBufferBytes, "stderr");
                    }
                },
                signal.signal
            );
            const status = execution.id ? await sandbox.commands.getCommandStatus(execution.id) : undefined;
            const stdout = Buffer.concat(stdoutChunks).toString("utf8");
            let stderr = Buffer.concat(stderrChunks).toString("utf8");
            const fallbackError = status?.error ?? execution.error?.value;
            if (fallbackError && !stderr.includes(fallbackError)) {
                stderr = stderr ? `${stderr}\n${fallbackError}` : fallbackError;
            }
            const exitCode =
                typeof status?.exitCode === "number" ? status.exitCode : opensandboxExitCodeResolve(execution);

            logger.debug(`exec: completed exitCode=${exitCode}`);
            return {
                stdout,
                stderr,
                exitCode
            };
        } finally {
            signal.cleanup();
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

function abortSignalForward(signal?: AbortSignal): { signal: AbortSignal; cleanup: () => void } {
    const controller = new AbortController();
    if (!signal) {
        return {
            signal: controller.signal,
            cleanup: () => undefined
        };
    }
    if (signal.aborted) {
        controller.abort();
    }
    const onAbort = () => controller.abort();
    signal.addEventListener("abort", onAbort, { once: true });
    return {
        signal: controller.signal,
        cleanup: () => signal.removeEventListener("abort", onAbort)
    };
}
