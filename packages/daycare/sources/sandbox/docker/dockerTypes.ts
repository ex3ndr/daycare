import type { Readable } from "node:stream";

import type Docker from "dockerode";
import type { PathMountPoint } from "../../utils/pathMountTypes.js";
import type { SandboxExecSignal, SandboxResourceLimitsConfig } from "../sandboxTypes.js";

export type DockerContainerConfig = {
    socketPath?: string;
    runtime?: string;
    readOnly: boolean;
    unconfinedSecurity: boolean;
    capAdd: string[];
    capDrop: string[];
    allowLocalNetworkingForUsers?: string[];
    isolatedDnsServers?: string[];
    localDnsServers?: string[];
    resourceLimits?: SandboxResourceLimitsConfig;
    userId: string;
    hostHomeDir: string;
    /** All mount points including home. Extra mounts are read-only. */
    mounts: PathMountPoint[];
};

export type DockerContainerResolvedConfig = DockerContainerConfig & {
    networkName: string;
};

export type DockerContainerExecArgs = {
    command: string[];
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    timeoutMs?: number;
    maxBufferBytes?: number;
    closeStdinToKill?: boolean;
    processTreeControlFile?: string;
    processTreePidFile?: string;
    signal?: AbortSignal;
};

export type DockerContainerExecResult = {
    stdout: string;
    stderr: string;
    exitCode: number | null;
    signal: string | null;
};

export type DockerContainerExecHandle = {
    stdout: Readable;
    stderr: Readable;
    wait: () => Promise<DockerContainerExecResult>;
    kill: (signal?: SandboxExecSignal) => Promise<void>;
};

export type DockerContainer = Docker.Container;
