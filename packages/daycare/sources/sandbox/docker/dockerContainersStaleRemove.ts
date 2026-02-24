import type Docker from "dockerode";

import { getLogger } from "../../log.js";
import { dockerImageIdResolve } from "./dockerImageIdResolve.js";
import { DOCKER_IMAGE_VERSION } from "./dockerImageVersion.js";

type DockerError = {
    statusCode?: number;
};

type DockerContainerSummary = {
    Id: string;
    Names?: string[];
    Labels?: Record<string, string>;
};

const logger = getLogger("sandbox.docker");
const DOCKER_IMAGE_VERSION_LABEL = "daycare.image.version";
const DOCKER_IMAGE_ID_LABEL = "daycare.image.id";

/**
 * Removes stale daycare sandbox containers by image version or image Id mismatch.
 * Expects: imageRef points to the runtime image used for sandbox containers.
 */
export async function dockerContainersStaleRemove(docker: Docker, imageRef: string): Promise<void> {
    const currentImageId = await dockerImageIdResolve(docker, imageRef);
    const containers = (await docker.listContainers({
        all: true,
        filters: {
            name: ["daycare-sandbox-"]
        }
    })) as DockerContainerSummary[];

    for (const container of containers) {
        const staleReason = containerStaleReasonResolve(container.Labels, currentImageId);
        if (!staleReason) {
            continue;
        }

        const handle = docker.getContainer(container.Id);
        await stopContainerIfNeeded(handle);
        await removeContainerIfNeeded(handle);

        const name = container.Names?.[0] ?? container.Id;
        logger.warn(
            { containerName: name, imageRef, staleReason },
            "stale: Removed stale Docker sandbox container during startup scan"
        );
    }
}

async function stopContainerIfNeeded(container: Docker.Container): Promise<void> {
    try {
        await container.stop();
    } catch (error) {
        if ((error as DockerError).statusCode !== 304 && (error as DockerError).statusCode !== 404) {
            throw error;
        }
    }
}

async function removeContainerIfNeeded(container: Docker.Container): Promise<void> {
    try {
        await container.remove();
    } catch (error) {
        if ((error as DockerError).statusCode !== 404) {
            throw error;
        }
    }
}

function containerStaleReasonResolve(
    labels: Record<string, string> | undefined,
    expectedImageId: string
): string | null {
    const version = labels?.[DOCKER_IMAGE_VERSION_LABEL];
    const imageId = labels?.[DOCKER_IMAGE_ID_LABEL];
    if (!version) {
        return "missing-version-label";
    }
    if (!imageId) {
        return "missing-image-id-label";
    }
    if (version !== DOCKER_IMAGE_VERSION) {
        return `version-mismatch:${version}->${DOCKER_IMAGE_VERSION}`;
    }
    if (imageId !== expectedImageId) {
        return "image-id-mismatch";
    }
    return null;
}
