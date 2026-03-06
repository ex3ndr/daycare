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
};

export interface SandboxExecBackend {
    exec(args: SandboxExecBackendArgs): Promise<SandboxExecBackendResult>;
}
