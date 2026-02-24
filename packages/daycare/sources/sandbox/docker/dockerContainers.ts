import Docker from "dockerode";

import { dockerContainerEnsure } from "./dockerContainerEnsure.js";
import { dockerContainerExec } from "./dockerContainerExec.js";
import { dockerNetworkNameResolveForUser } from "./dockerNetworkNameResolveForUser.js";
import { dockerNetworksEnsure } from "./dockerNetworksEnsure.js";
import type {
    DockerContainer,
    DockerContainerConfig,
    DockerContainerExecArgs,
    DockerContainerExecResult,
    DockerContainerResolvedConfig
} from "./dockerTypes.js";

/**
 * Facade for per-user long-lived Docker sandbox containers.
 * Expects: callers pass stable userId + hostHomeDir for each execution.
 */
export class DockerContainers {
    private readonly clientsBySocket = new Map<string, Docker>();
    private readonly ensureInFlight = new Map<string, Promise<DockerContainer>>();
    private readonly networksEnsureInFlight = new Map<string, Promise<void>>();
    private readonly networksReady = new Set<string>();

    async exec(config: DockerContainerConfig, args: DockerContainerExecArgs): Promise<DockerContainerExecResult> {
        const socketKey = config.socketPath ?? "default";
        const docker = this.dockerClientResolve(config.socketPath);
        await this.networksEnsure(docker, socketKey);
        const resolvedConfig: DockerContainerResolvedConfig = {
            ...config,
            networkName: dockerNetworkNameResolveForUser(config.userId, config.allowLocalNetworkingForUsers ?? [])
        };
        const container = await this.containerEnsure(docker, resolvedConfig);
        return dockerContainerExec(docker, container, args);
    }

    private dockerClientResolve(socketPath?: string): Docker {
        const key = socketPath ?? "default";
        const cached = this.clientsBySocket.get(key);
        if (cached) {
            return cached;
        }

        const docker = socketPath ? new Docker({ socketPath }) : new Docker();
        this.clientsBySocket.set(key, docker);
        return docker;
    }

    private async containerEnsure(docker: Docker, config: DockerContainerResolvedConfig): Promise<DockerContainer> {
        const key = `${config.socketPath ?? "default"}:${config.userId}`;
        const pending = this.ensureInFlight.get(key);
        if (pending) {
            return pending;
        }

        const operation = dockerContainerEnsure(docker, config);
        this.ensureInFlight.set(key, operation);

        try {
            return await operation;
        } finally {
            this.ensureInFlight.delete(key);
        }
    }

    private async networksEnsure(docker: Docker, socketKey: string): Promise<void> {
        if (this.networksReady.has(socketKey)) {
            return;
        }
        const pending = this.networksEnsureInFlight.get(socketKey);
        if (pending) {
            return pending;
        }

        const operation = dockerNetworksEnsure(docker);
        this.networksEnsureInFlight.set(socketKey, operation);

        try {
            await operation;
            this.networksReady.add(socketKey);
        } finally {
            this.networksEnsureInFlight.delete(socketKey);
        }
    }
}
