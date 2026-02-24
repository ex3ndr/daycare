import type { SessionPermissions } from "@/types";
import type { SandboxPackageManager } from "./sandboxPackageManagers.js";

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
    packageManagers?: SandboxPackageManager[];
    allowedDomains?: string[];
};

export type SandboxExecResult = {
    stdout: string;
    stderr: string;
    exitCode: number | null;
    signal: string | null;
    failed: boolean;
    cwd: string;
};

export type SandboxDockerConfig = {
    enabled: boolean;
    image: string;
    tag: string;
    socketPath?: string;
    runtime?: string;
    enableWeakerNestedSandbox: boolean;
    readOnly: boolean;
    unconfinedSecurity: boolean;
    capAdd: string[];
    capDrop: string[];
    userId: string;
    skillsActiveDir: string;
};

export type SandboxConfig = {
    homeDir: string;
    permissions: SessionPermissions;
    docker?: SandboxDockerConfig;
};
