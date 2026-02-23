import path from "node:path";
import type Docker from "dockerode";

import { dockerContainerNameBuild } from "./dockerContainerNameBuild.js";
import type { DockerContainerConfig } from "./dockerTypes.js";

type DockerError = {
    statusCode?: number;
};

/**
 * Ensures a long-lived sandbox container exists and is running for a user.
 * Expects: image:tag exists locally and hostHomeDir is an absolute host path.
 */
export async function dockerContainerEnsure(docker: Docker, config: DockerContainerConfig): Promise<Docker.Container> {
    const containerName = dockerContainerNameBuild(config.userId);
    const existing = docker.getContainer(containerName);

    try {
        const details = await existing.inspect();
        if (!details.State?.Running) {
            await startContainerIfNeeded(existing);
        }
        return existing;
    } catch (error) {
        if ((error as DockerError).statusCode !== 404) {
            throw error;
        }
    }

    const hostHomeDir = path.resolve(config.hostHomeDir);
    const containerHomeDir = `/home/${config.userId}`;

    try {
        const created = await docker.createContainer({
            name: containerName,
            Image: `${config.image}:${config.tag}`,
            Cmd: ["sleep", "infinity"],
            WorkingDir: containerHomeDir,
            HostConfig: {
                Binds: [`${hostHomeDir}:${containerHomeDir}`],
                ...(config.runtime ? { Runtime: config.runtime } : {})
            }
        });
        await startContainerIfNeeded(created);
        return created;
    } catch (error) {
        if ((error as DockerError).statusCode !== 409) {
            throw error;
        }
        const concurrentContainer = docker.getContainer(containerName);
        await startContainerIfNeeded(concurrentContainer);
        return concurrentContainer;
    }
}

async function startContainerIfNeeded(container: Docker.Container): Promise<void> {
    try {
        await container.start();
    } catch (error) {
        if ((error as DockerError).statusCode !== 304) {
            throw error;
        }
    }
}
