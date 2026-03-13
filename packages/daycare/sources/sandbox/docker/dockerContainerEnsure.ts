import { promises as fs } from "node:fs";
import path from "node:path";
import type Docker from "dockerode";

import { getLogger } from "../../log.js";
import { sandboxResourceLimitsResolve } from "../sandboxResourceLimitsResolve.js";
import { dockerContainerNameBuild } from "./dockerContainerNameBuild.js";
import { dockerContainerNetworkStateResolve } from "./dockerContainerNetworkStateResolve.js";
import { dockerDnsProfileResolve } from "./dockerDnsProfileResolve.js";
import { dockerImageIdResolve } from "./dockerImageIdResolve.js";
import { DOCKER_IMAGE_VERSION } from "./dockerImageVersion.js";
import type { DockerContainerResolvedConfig } from "./dockerTypes.js";

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
    NetworkSettings?: {
        Networks?: Record<string, unknown>;
    };
    Mounts?: DockerInspectMount[];
};

type DockerInspectMount = {
    Source?: string;
    Destination?: string;
    RW?: boolean;
};

const logger = getLogger("sandbox.docker");
const DOCKER_IMAGE_VERSION_LABEL = "daycare.image.version";
const DOCKER_IMAGE_ID_LABEL = "daycare.image.id";
const DOCKER_SECURITY_PROFILE_LABEL = "daycare.security.profile";
const DOCKER_CAPABILITIES_LABEL = "daycare.capabilities";
const DOCKER_READONLY_LABEL = "daycare.readonly";
const DOCKER_NETWORK_LABEL = "daycare.network";
const DOCKER_DNS_PROFILE_LABEL = "daycare.dns.profile";
const DOCKER_DNS_SERVERS_LABEL = "daycare.dns.servers";
const DOCKER_DNS_RESOLVER_LABEL = "daycare.dns.resolver";
const DOCKER_RESOURCE_CPU_LABEL = "daycare.resource.cpu";
const DOCKER_RESOURCE_MEMORY_LABEL = "daycare.resource.memory";
const DOCKER_TMPFS_TMP_LABEL = "daycare.tmpfs.tmp";
const DOCKER_TMPFS_RUN_LABEL = "daycare.tmpfs.run";
const DOCKER_TMPFS_VAR_TMP_LABEL = "daycare.tmpfs.var_tmp";
const DOCKER_TMPFS_VAR_RUN_LABEL = "daycare.tmpfs.var_run";
const DOCKER_TMPFS_DEV_SHM_LABEL = "daycare.tmpfs.dev_shm";
const DOCKER_SECURITY_PROFILE_DEFAULT = "default";
const DOCKER_SECURITY_PROFILE_UNCONFINED = "unconfined";
const DOCKER_SECURITY_OPT_UNCONFINED = ["seccomp=unconfined", "apparmor=unconfined"] as const;
const DOCKER_DNS_RESOLVER_DOCKER = "docker";
const DOCKER_DNS_RESOLVER_BIND = "bind";
const DOCKER_TMPFS_TMP_ENABLED = "1";
const DOCKER_TMPFS_RUN_ENABLED = "1";
const DOCKER_TMPFS_VAR_TMP_ENABLED = "1";
const DOCKER_TMPFS_VAR_RUN_ENABLED = "1";
const DOCKER_TMPFS_DEV_SHM_ENABLED = "1";
const DOCKER_SHM_SIZE_BYTES = 1024 * 1024 * 1024;
const DOCKER_INIT_LABEL = "daycare.init";
const DOCKER_INIT_ENABLED = "1";
const DAYCARE_RUNTIME_IMAGE_REF = "daycare-runtime:latest";

/**
 * Ensures a long-lived sandbox container exists and is running for a user.
 * Expects: image:tag exists locally and hostHomeDir is an absolute host path.
 */
export async function dockerContainerEnsure(
    docker: Docker,
    config: DockerContainerResolvedConfig
): Promise<Docker.Container> {
    const containerName = dockerContainerNameBuild(config.userId);
    const imageRef = DAYCARE_RUNTIME_IMAGE_REF;
    const hostHomeDir = path.resolve(config.hostHomeDir);
    const extraMounts = config.mounts.filter((m) => m.mappedPath !== "/home");
    const imageId = await dockerImageIdResolve(docker);
    const dnsProfile = dockerDnsProfileResolve({
        networkName: config.networkName,
        isolatedDnsServers: config.isolatedDnsServers,
        localDnsServers: config.localDnsServers
    });
    const resourceLimits = sandboxResourceLimitsResolve(config.resourceLimits);
    const dnsServersLabel = dockerDnsServersLabelResolve(dnsProfile.dnsServers);
    const dnsResolverLabel = dnsProfile.dnsServers ? DOCKER_DNS_RESOLVER_BIND : DOCKER_DNS_RESOLVER_DOCKER;
    const resourceCpuLabel = String(resourceLimits.cpu);
    const resourceMemoryLabel = resourceLimits.memory;
    const existing = docker.getContainer(containerName);

    try {
        const details = (await existing.inspect()) as DockerContainerInspect;
        const staleReason = containerStaleReasonResolve(
            details,
            imageId,
            config.readOnly,
            config.unconfinedSecurity,
            config.capAdd,
            config.capDrop,
            config.networkName,
            dnsProfile.profileLabel,
            dnsServersLabel,
            dnsResolverLabel,
            resourceCpuLabel,
            resourceMemoryLabel,
            hostHomeDir,
            extraMounts
        );
        if (staleReason) {
            logger.warn(
                { containerName, imageRef, staleReason },
                "stale: Removing Docker sandbox container because configuration changed"
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

    const securityProfile = config.unconfinedSecurity
        ? DOCKER_SECURITY_PROFILE_UNCONFINED
        : DOCKER_SECURITY_PROFILE_DEFAULT;
    const securityOpt = config.unconfinedSecurity ? [...DOCKER_SECURITY_OPT_UNCONFINED] : undefined;
    const capabilitiesLabel = dockerCapabilitiesLabelBuild(config.capAdd, config.capDrop);
    const readOnlyLabel = config.readOnly ? "1" : "0";
    const dnsResolvBind = await dockerDnsResolvBindResolve(hostHomeDir, dnsProfile.dnsServers);
    const binds = [
        `${hostHomeDir}:/home`,
        ...extraMounts.map((mount) => {
            const base = `${path.resolve(mount.hostPath)}:${mount.mappedPath}`;
            return mount.readOnly === false ? base : `${base}:ro`;
        })
    ];
    if (dnsResolvBind) {
        binds.push(dnsResolvBind);
    }

    try {
        const created = await docker.createContainer({
            name: containerName,
            Image: imageRef,
            WorkingDir: "/home",
            Labels: {
                [DOCKER_IMAGE_VERSION_LABEL]: DOCKER_IMAGE_VERSION,
                [DOCKER_IMAGE_ID_LABEL]: imageId,
                [DOCKER_SECURITY_PROFILE_LABEL]: securityProfile,
                [DOCKER_CAPABILITIES_LABEL]: capabilitiesLabel,
                [DOCKER_READONLY_LABEL]: readOnlyLabel,
                [DOCKER_NETWORK_LABEL]: config.networkName,
                [DOCKER_DNS_PROFILE_LABEL]: dnsProfile.profileLabel,
                [DOCKER_DNS_SERVERS_LABEL]: dnsServersLabel,
                [DOCKER_DNS_RESOLVER_LABEL]: dnsResolverLabel,
                [DOCKER_RESOURCE_CPU_LABEL]: resourceCpuLabel,
                [DOCKER_RESOURCE_MEMORY_LABEL]: resourceMemoryLabel,
                [DOCKER_TMPFS_TMP_LABEL]: DOCKER_TMPFS_TMP_ENABLED,
                [DOCKER_TMPFS_RUN_LABEL]: DOCKER_TMPFS_RUN_ENABLED,
                [DOCKER_TMPFS_VAR_TMP_LABEL]: DOCKER_TMPFS_VAR_TMP_ENABLED,
                [DOCKER_TMPFS_VAR_RUN_LABEL]: DOCKER_TMPFS_VAR_RUN_ENABLED,
                [DOCKER_TMPFS_DEV_SHM_LABEL]: DOCKER_TMPFS_DEV_SHM_ENABLED,
                [DOCKER_INIT_LABEL]: DOCKER_INIT_ENABLED
            },
            HostConfig: {
                Binds: binds,
                NetworkMode: config.networkName,
                NanoCpus: resourceLimits.nanoCpus,
                Memory: resourceLimits.memoryBytes,
                MemorySwap: resourceLimits.memoryBytes,
                ShmSize: DOCKER_SHM_SIZE_BYTES,
                Init: true,
                Tmpfs: {
                    "/tmp": "rw",
                    "/run": "rw",
                    "/var/tmp": "rw",
                    "/var/run": "rw"
                },
                ...(dnsProfile.dnsServers ? { Dns: dnsProfile.dnsServers } : {}),
                ...(config.runtime ? { Runtime: config.runtime } : {}),
                ...(config.readOnly ? { ReadonlyRootfs: true } : {}),
                ...(config.capAdd.length > 0 ? { CapAdd: config.capAdd } : {}),
                ...(config.capDrop.length > 0 ? { CapDrop: config.capDrop } : {}),
                ...(securityOpt ? { SecurityOpt: securityOpt } : {})
            },
            NetworkingConfig: {
                EndpointsConfig: {
                    [config.networkName]: {}
                }
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
    readOnly: boolean,
    unconfinedSecurity: boolean,
    capAdd: string[],
    capDrop: string[],
    expectedNetworkName: string,
    expectedDnsProfileLabel: string,
    expectedDnsServersLabel: string,
    expectedDnsResolverLabel: string,
    expectedResourceCpuLabel: string,
    expectedResourceMemoryLabel: string,
    expectedHostHomeDir: string,
    expectedExtraMounts: Array<{ hostPath: string; mappedPath: string; readOnly?: boolean }>
): string | null {
    const labels = details.Config?.Labels;
    const version = labels?.[DOCKER_IMAGE_VERSION_LABEL];
    const imageId = labels?.[DOCKER_IMAGE_ID_LABEL];
    const securityProfile = labels?.[DOCKER_SECURITY_PROFILE_LABEL];
    const capabilities = labels?.[DOCKER_CAPABILITIES_LABEL];
    const readOnlyLabel = labels?.[DOCKER_READONLY_LABEL];
    const networkLabel = labels?.[DOCKER_NETWORK_LABEL];
    const dnsProfileLabel = labels?.[DOCKER_DNS_PROFILE_LABEL];
    const dnsServersLabel = labels?.[DOCKER_DNS_SERVERS_LABEL];
    const dnsResolverLabel = labels?.[DOCKER_DNS_RESOLVER_LABEL];
    const resourceCpuLabel = labels?.[DOCKER_RESOURCE_CPU_LABEL];
    const resourceMemoryLabel = labels?.[DOCKER_RESOURCE_MEMORY_LABEL];
    const tmpfsTmpLabel = labels?.[DOCKER_TMPFS_TMP_LABEL];
    const tmpfsRunLabel = labels?.[DOCKER_TMPFS_RUN_LABEL];
    const tmpfsVarTmpLabel = labels?.[DOCKER_TMPFS_VAR_TMP_LABEL];
    const tmpfsVarRunLabel = labels?.[DOCKER_TMPFS_VAR_RUN_LABEL];
    const tmpfsDevShmLabel = labels?.[DOCKER_TMPFS_DEV_SHM_LABEL];
    const initLabel = labels?.[DOCKER_INIT_LABEL];
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
    if (!readOnlyLabel) {
        return "missing-readonly-label";
    }
    if (!dnsProfileLabel) {
        return "missing-dns-profile-label";
    }
    if (!dnsServersLabel) {
        return "missing-dns-servers-label";
    }
    if (!dnsResolverLabel) {
        return "missing-dns-resolver-label";
    }
    if (!resourceCpuLabel) {
        return "missing-resource-cpu-label";
    }
    if (!resourceMemoryLabel) {
        return "missing-resource-memory-label";
    }
    if (!tmpfsTmpLabel) {
        return "missing-tmpfs-tmp-label";
    }
    if (!tmpfsRunLabel) {
        return "missing-tmpfs-run-label";
    }
    if (!tmpfsVarTmpLabel) {
        return "missing-tmpfs-var-tmp-label";
    }
    if (!tmpfsVarRunLabel) {
        return "missing-tmpfs-var-run-label";
    }
    if (!tmpfsDevShmLabel) {
        return "missing-tmpfs-dev-shm-label";
    }
    const networkState = dockerContainerNetworkStateResolve(details, expectedNetworkName);
    if (networkState !== "correct") {
        return `network-mismatch:${expectedNetworkName}`;
    }
    const expectedMounts: DockerExpectedMount[] = [
        { label: "home", source: expectedHostHomeDir, destination: "/home", writable: true },
        ...expectedExtraMounts.map((m) => ({
            label: m.mappedPath.replace(/^\//, "").replace(/\//g, "-"),
            source: path.resolve(m.hostPath),
            destination: m.mappedPath,
            writable: m.readOnly === false
        }))
    ];
    const mountReason = dockerMountsStaleReasonResolve(details.Mounts, expectedMounts);
    if (mountReason) {
        return mountReason;
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
    const expectedReadOnlyLabel = readOnly ? "1" : "0";
    if (readOnlyLabel !== expectedReadOnlyLabel) {
        return `readonly-mismatch:${readOnlyLabel}->${expectedReadOnlyLabel}`;
    }
    if (networkLabel && networkLabel !== expectedNetworkName) {
        return `network-label-mismatch:${networkLabel}->${expectedNetworkName}`;
    }
    if (dnsProfileLabel !== expectedDnsProfileLabel) {
        return `dns-profile-mismatch:${dnsProfileLabel}->${expectedDnsProfileLabel}`;
    }
    if (dnsServersLabel !== expectedDnsServersLabel) {
        return `dns-servers-mismatch:${dnsServersLabel}->${expectedDnsServersLabel}`;
    }
    if (dnsResolverLabel !== expectedDnsResolverLabel) {
        return `dns-resolver-mismatch:${dnsResolverLabel}->${expectedDnsResolverLabel}`;
    }
    if (resourceCpuLabel !== expectedResourceCpuLabel) {
        return `resource-cpu-mismatch:${resourceCpuLabel}->${expectedResourceCpuLabel}`;
    }
    if (resourceMemoryLabel !== expectedResourceMemoryLabel) {
        return `resource-memory-mismatch:${resourceMemoryLabel}->${expectedResourceMemoryLabel}`;
    }
    if (tmpfsTmpLabel !== DOCKER_TMPFS_TMP_ENABLED) {
        return `tmpfs-tmp-mismatch:${tmpfsTmpLabel}->${DOCKER_TMPFS_TMP_ENABLED}`;
    }
    if (tmpfsRunLabel !== DOCKER_TMPFS_RUN_ENABLED) {
        return `tmpfs-run-mismatch:${tmpfsRunLabel}->${DOCKER_TMPFS_RUN_ENABLED}`;
    }
    if (tmpfsVarTmpLabel !== DOCKER_TMPFS_VAR_TMP_ENABLED) {
        return `tmpfs-var-tmp-mismatch:${tmpfsVarTmpLabel}->${DOCKER_TMPFS_VAR_TMP_ENABLED}`;
    }
    if (tmpfsVarRunLabel !== DOCKER_TMPFS_VAR_RUN_ENABLED) {
        return `tmpfs-var-run-mismatch:${tmpfsVarRunLabel}->${DOCKER_TMPFS_VAR_RUN_ENABLED}`;
    }
    if (tmpfsDevShmLabel !== DOCKER_TMPFS_DEV_SHM_ENABLED) {
        return `tmpfs-dev-shm-mismatch:${tmpfsDevShmLabel}->${DOCKER_TMPFS_DEV_SHM_ENABLED}`;
    }
    if (initLabel !== DOCKER_INIT_ENABLED) {
        return "missing-init-label";
    }
    return null;
}

type DockerExpectedMount = {
    label: string;
    source: string;
    destination: string;
    writable: boolean;
};

function dockerMountsStaleReasonResolve(
    mounts: DockerInspectMount[] | undefined,
    expectedMounts: DockerExpectedMount[]
): string | null {
    if (!mounts) {
        return null;
    }
    for (const expectedMount of expectedMounts) {
        const reason = dockerMountStaleReasonResolve(mounts, expectedMount);
        if (reason) {
            return reason;
        }
    }
    return null;
}

function dockerMountStaleReasonResolve(
    mounts: DockerInspectMount[],
    expectedMount: DockerExpectedMount
): string | null {
    const actual = mounts.find((mount) => mount.Destination === expectedMount.destination);
    if (!actual) {
        return `missing-${expectedMount.label}-mount`;
    }
    if (!actual.Source) {
        return `${expectedMount.label}-mount-source-missing`;
    }
    if (path.resolve(actual.Source) !== path.resolve(expectedMount.source)) {
        return `${expectedMount.label}-mount-source-mismatch`;
    }
    if (typeof actual.RW === "boolean" && actual.RW !== expectedMount.writable) {
        return `${expectedMount.label}-mount-mode-mismatch`;
    }
    return null;
}

function dockerCapabilitiesLabelBuild(capAdd: string[], capDrop: string[]): string {
    const normalizedAdd = [...capAdd].sort();
    const normalizedDrop = [...capDrop].sort();
    return `add=${normalizedAdd.join(",")};drop=${normalizedDrop.join(",")}`;
}

function dockerDnsServersLabelResolve(dnsServers: string[] | undefined): string {
    if (!dnsServers || dnsServers.length === 0) {
        return "default";
    }
    return dnsServers.join(",");
}

async function dockerDnsResolvBindResolve(
    hostHomeDir: string,
    dnsServers: string[] | undefined
): Promise<string | null> {
    if (!dnsServers || dnsServers.length === 0) {
        return null;
    }
    const hostTmpDir = path.join(hostHomeDir, ".tmp");
    const hostResolvPath = path.join(hostTmpDir, "daycare-resolv.conf");
    await fs.mkdir(hostTmpDir, { recursive: true });
    await fs.writeFile(hostResolvPath, dockerResolvContentBuild(dnsServers), "utf8");
    return `${hostResolvPath}:/etc/resolv.conf:ro`;
}

function dockerResolvContentBuild(dnsServers: string[]): string {
    const lines = ["# Managed by Daycare"];
    for (const dnsServer of dnsServers) {
        lines.push(`nameserver ${dnsServer}`);
    }
    lines.push("options ndots:0");
    return `${lines.join("\n")}\n`;
}
