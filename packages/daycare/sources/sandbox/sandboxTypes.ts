import type { Readable } from "node:stream";

import type { SessionPermissions } from "@/types";

export type SandboxReadArgs = {
    path: string;
    offset?: number;
    limit?: number;
    raw?: boolean;
    binary?: boolean;
};

export type SandboxReadResultText = {
    type: "text";
    content: string;
    bytes: number;
    totalLines: number;
    outputLines: number;
    truncated: boolean;
    truncatedBy: "lines" | "bytes" | null;
    resolvedPath: string;
    displayPath: string;
};

export type SandboxReadResultImage = {
    type: "image";
    content: Buffer;
    bytes: number;
    mimeType: string;
    resolvedPath: string;
    displayPath: string;
};

export type SandboxReadResultBinary = {
    type: "binary";
    content: Buffer;
    bytes: number;
    resolvedPath: string;
    displayPath: string;
};

export type SandboxReadResult = SandboxReadResultText | SandboxReadResultImage | SandboxReadResultBinary;

export type SandboxWriteArgs = {
    path: string;
    content: string | Buffer;
    append?: boolean;
    exclusive?: boolean;
};

export type SandboxWriteResult = {
    bytes: number;
    resolvedPath: string;
    sandboxPath: string;
};

export type SandboxExecArgs = {
    command: string;
    cwd?: string;
    timeoutMs?: number;
    env?: Record<string, string | number | boolean>;
    secrets?: Record<string, string>;
    dotenv?: boolean | string;
    signal?: AbortSignal;
};

export type SandboxExecSignal = "SIGTERM" | "SIGINT" | "SIGHUP" | "SIGKILL";

export type SandboxExecResult = {
    stdout: string;
    stderr: string;
    exitCode: number | null;
    signal: string | null;
    failed: boolean;
    cwd: string;
};

export type SandboxExecHandle = {
    stdout: Readable;
    stderr: Readable;
    wait: () => Promise<SandboxExecResult>;
    kill: (signal?: SandboxExecSignal) => Promise<void>;
};

export type SandboxMount = {
    hostPath: string;
    mappedPath: string;
    readOnly?: boolean;
};

export type SandboxDockerConfig = {
    socketPath?: string;
    runtime?: string;
    readOnly: boolean;
    unconfinedSecurity: boolean;
    capAdd: string[];
    capDrop: string[];
    allowLocalNetworkingForUsers?: string[];
    isolatedDnsServers?: string[];
    localDnsServers?: string[];
    userId: string;
};

export type SandboxOpenSandboxConfig = {
    domain: string;
    apiKey?: string;
    image: string;
    userId: string;
    timeoutSeconds: number;
};

export type SandboxBackendConfig =
    | {
          type: "docker";
          docker: SandboxDockerConfig;
      }
    | {
          type: "opensandbox";
          opensandbox: SandboxOpenSandboxConfig;
      };

export type SandboxConfig = {
    homeDir: string;
    permissions: SessionPermissions;
    mounts?: SandboxMount[];
    backend: SandboxBackendConfig;
};
