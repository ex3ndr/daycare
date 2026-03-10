import type { Readable } from "node:stream";

import type { SandboxExecSignal } from "./sandboxTypes.js";

/**
 * Arguments for backend-specific command execution.
 * Expects: command is a shell command string and env already includes merged dotenv/secrets.
 */
export type SandboxExecBackendArgs = {
    command: string;
    cwd?: string;
    env: NodeJS.ProcessEnv;
    timeoutMs: number;
    maxBufferBytes: number;
    signal?: AbortSignal;
};

export type SandboxExecBackendResult = {
    stdout: string;
    stderr: string;
    exitCode: number | null;
    signal: string | null;
};

export type SandboxExecBackendHandle = {
    stdout: Readable;
    stderr: Readable;
    wait: () => Promise<SandboxExecBackendResult>;
    kill: (signal?: SandboxExecSignal) => Promise<void>;
};

export interface SandboxExecBackend {
    exec(args: SandboxExecBackendArgs): Promise<SandboxExecBackendHandle>;
}
