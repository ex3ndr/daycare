import Docker from "dockerode";

import { dockerContainerEnsure } from "./dockerContainerEnsure.js";
import { dockerContainerExec } from "./dockerContainerExec.js";
import type {
    DockerContainer,
    DockerContainerConfig,
    DockerContainerExecArgs,
    DockerContainerExecResult
} from "./dockerTypes.js";

/**
 * Facade for per-user long-lived Docker sandbox containers.
 * Expects: callers pass stable userId + hostHomeDir for each execution.
 */
export class DockerContainers {
    private readonly clientsBySocket = new Map<string, Docker>();
    private readonly ensureInFlight = new Map<string, Promise<DockerContainer>>();

    async exec(config: DockerContainerConfig, args: DockerContainerExecArgs): Promise<DockerContainerExecResult> {
        const docker = this.dockerClientResolve(config.socketPath);
        const container = await this.containerEnsure(docker, config);
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

    private async containerEnsure(docker: Docker, config: DockerContainerConfig): Promise<DockerContainer> {
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
}
