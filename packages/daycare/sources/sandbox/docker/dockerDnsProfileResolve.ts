import { DOCKER_NETWORK_ISOLATED } from "./dockerNetworkNames.js";

const DOCKER_DNS_PUBLIC_SERVERS = ["1.1.1.1", "8.8.8.8"] as const;

export type DockerDnsProfile = {
    profileLabel: "default" | "private" | "public";
    dnsServers?: string[];
};

export type DockerDnsProfileResolveInput = {
    networkName: string;
    isolatedDnsServers?: string[];
    localDnsServers?: string[];
};

/**
 * Resolves DNS policy for a sandbox container based on selected network.
 * Expects: networkName is a known Daycare Docker network name.
 */
export function dockerDnsProfileResolve(input: DockerDnsProfileResolveInput): DockerDnsProfile {
    if (input.networkName === DOCKER_NETWORK_ISOLATED) {
        return {
            profileLabel: "public",
            dnsServers: input.isolatedDnsServers?.length
                ? [...input.isolatedDnsServers]
                : [...DOCKER_DNS_PUBLIC_SERVERS]
        };
    }

    if (input.localDnsServers?.length) {
        return {
            profileLabel: "private",
            dnsServers: [...input.localDnsServers]
        };
    }

    return {
        profileLabel: "default"
    };
}
