import path from "node:path";
import type Docker from "dockerode";

import { getLogger } from "../../log.js";
import { dockerContainerNameBuild } from "./dockerContainerNameBuild.js";
import { dockerImageIdResolve } from "./dockerImageIdResolve.js";
import { DOCKER_IMAGE_VERSION } from "./dockerImageVersion.js";
import type { DockerContainerConfig } from "./dockerTypes.js";

type DockerError = {
    statusCode?: number;
};

type DockerContainerInspect = {
    State?: {
        Running?: boolean;
    };
    Config?: {
        Labels?: Record<string, string>;
    };
};

const logger = getLogger("sandbox.docker");
const DOCKER_IMAGE_VERSION_LABEL = "daycare.image.version";
const DOCKER_IMAGE_ID_LABEL = "daycare.image.id";
const DOCKER_SECURITY_PROFILE_LABEL = "daycare.security.profile";
const DOCKER_CAPABILITIES_LABEL = "daycare.capabilities";
const DOCKER_SECURITY_PROFILE_DEFAULT = "default";
const DOCKER_SECURITY_PROFILE_UNCONFINED = "unconfined";
const DOCKER_SECURITY_OPT_UNCONFINED = ["seccomp=unconfined", "apparmor=unconfined"] as const;

/**
 * Ensures a long-lived sandbox container exists and is running for a user.
 * Expects: image:tag exists locally and hostHomeDir is an absolute host path.
 */
export async function dockerContainerEnsure(docker: Docker, config: DockerContainerConfig): Promise<Docker.Container> {
    const containerName = dockerContainerNameBuild(config.userId);
    const imageRef = `${config.image}:${config.tag}`;
    const imageId = await dockerImageIdResolve(docker, imageRef);
    const existing = docker.getContainer(containerName);

    try {
        const details = (await existing.inspect()) as DockerContainerInspect;
        const staleReason = containerStaleReasonResolve(
            details,
            imageId,
            config.unconfinedSecurity,
            config.capAdd,
            config.capDrop
        );
        if (staleReason) {
            logger.warn(
                { containerName, imageRef, staleReason },
                "stale: Removing Docker sandbox container because image metadata changed"
            );
            await stopContainerIfNeeded(existing);
            await removeContainerIfNeeded(existing);
        } else if (!details.State?.Running) {
            await startContainerIfNeeded(existing);
            return existing;
        } else {
            return existing;
        }
    } catch (error) {
        if ((error as DockerError).statusCode !== 404) {
            throw error;
        }
    }

    const hostHomeDir = path.resolve(config.hostHomeDir);
    const hostSkillsActiveDir = path.resolve(config.hostSkillsActiveDir);
    const containerHomeDir = "/home";
    const containerSkillsDir = "/shared/skills";
    const securityProfile = config.unconfinedSecurity
        ? DOCKER_SECURITY_PROFILE_UNCONFINED
        : DOCKER_SECURITY_PROFILE_DEFAULT;
    const securityOpt = config.unconfinedSecurity ? [...DOCKER_SECURITY_OPT_UNCONFINED] : undefined;
    const capabilitiesLabel = dockerCapabilitiesLabelBuild(config.capAdd, config.capDrop);

    try {
        const created = await docker.createContainer({
            name: containerName,
            Image: imageRef,
            WorkingDir: containerHomeDir,
            Labels: {
                [DOCKER_IMAGE_VERSION_LABEL]: DOCKER_IMAGE_VERSION,
                [DOCKER_IMAGE_ID_LABEL]: imageId,
                [DOCKER_SECURITY_PROFILE_LABEL]: securityProfile,
                [DOCKER_CAPABILITIES_LABEL]: capabilitiesLabel
            },
            HostConfig: {
                Binds: [`${hostHomeDir}:${containerHomeDir}`, `${hostSkillsActiveDir}:${containerSkillsDir}:ro`],
                ...(config.runtime ? { Runtime: config.runtime } : {}),
                ...(config.capAdd.length > 0 ? { CapAdd: config.capAdd } : {}),
                ...(config.capDrop.length > 0 ? { CapDrop: config.capDrop } : {}),
                ...(securityOpt ? { SecurityOpt: securityOpt } : {})
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

async function stopContainerIfNeeded(container: Docker.Container): Promise<void> {
    try {
        await container.stop();
    } catch (error) {
        if ((error as DockerError).statusCode !== 304) {
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
    details: DockerContainerInspect,
    expectedImageId: string,
    unconfinedSecurity: boolean,
    capAdd: string[],
    capDrop: string[]
): string | null {
    const labels = details.Config?.Labels;
    const version = labels?.[DOCKER_IMAGE_VERSION_LABEL];
    const imageId = labels?.[DOCKER_IMAGE_ID_LABEL];
    const securityProfile = labels?.[DOCKER_SECURITY_PROFILE_LABEL];
    const capabilities = labels?.[DOCKER_CAPABILITIES_LABEL];
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
    if (!securityProfile) {
        return "missing-security-profile-label";
    }
    if (!capabilities) {
        return "missing-capabilities-label";
    }
    const expectedSecurityProfile = unconfinedSecurity
        ? DOCKER_SECURITY_PROFILE_UNCONFINED
        : DOCKER_SECURITY_PROFILE_DEFAULT;
    if (securityProfile !== expectedSecurityProfile) {
        return `security-profile-mismatch:${securityProfile}->${expectedSecurityProfile}`;
    }
    const expectedCapabilities = dockerCapabilitiesLabelBuild(capAdd, capDrop);
    if (capabilities !== expectedCapabilities) {
        return `capabilities-mismatch:${capabilities}->${expectedCapabilities}`;
    }
    return null;
}

function dockerCapabilitiesLabelBuild(capAdd: string[], capDrop: string[]): string {
    const normalizedAdd = [...capAdd].sort();
    const normalizedDrop = [...capDrop].sort();
    return `add=${normalizedAdd.join(",")};drop=${normalizedDrop.join(",")}`;
}
