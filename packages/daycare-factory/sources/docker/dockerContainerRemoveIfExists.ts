import type Docker from "dockerode";

interface DockerError {
    statusCode?: number;
}

/**
 * Removes a Docker container by name if it already exists.
 * Expects: docker client can access the local Docker daemon.
 */
export async function dockerContainerRemoveIfExists(docker: Docker, containerName: string): Promise<void> {
    const container = docker.getContainer(containerName);

    try {
        const containerInfo = await container.inspect();
        if (containerInfo.State?.Running) {
            await container.stop({ t: 5 });
        }
        await container.remove({ force: true });
    } catch (error) {
        if ((error as DockerError).statusCode === 404) {
            return;
        }
        throw error;
    }
}
