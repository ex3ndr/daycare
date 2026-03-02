import type Docker from "dockerode";
import type { PathMountPoint } from "../../utils/pathMountTypes.js";

export type DockerContainerConfig = {
    image: string;
    tag: string;
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
    signal?: AbortSignal;
};

export type DockerContainerExecResult = {
    stdout: string;
    stderr: string;
    exitCode: number | null;
};

export type DockerContainer = Docker.Container;
