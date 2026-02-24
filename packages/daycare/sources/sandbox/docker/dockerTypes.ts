import type Docker from "dockerode";

export type DockerContainerConfig = {
    image: string;
    tag: string;
    socketPath?: string;
    runtime?: string;
    userId: string;
    hostHomeDir: string;
    hostSkillsActiveDir: string;
};

export type DockerContainerExecArgs = {
    command: string[];
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    timeoutMs?: number;
    maxBufferBytes?: number;
};

export type DockerContainerExecResult = {
    stdout: string;
    stderr: string;
    exitCode: number | null;
};

export type DockerContainer = Docker.Container;
