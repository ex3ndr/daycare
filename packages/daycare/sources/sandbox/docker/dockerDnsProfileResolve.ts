import { DOCKER_NETWORK_ISOLATED } from "./dockerNetworkNames.js";

const DOCKER_DNS_PUBLIC_SERVERS = ["1.1.1.1", "8.8.8.8"] as const;

export type DockerDnsProfile = {
    profileLabel: "default" | "public";
    dnsServers?: string[];
};

/**
 * Resolves DNS policy for a sandbox container based on selected network.
 * Expects: networkName is a known Daycare Docker network name.
 */
export function dockerDnsProfileResolve(networkName: string): DockerDnsProfile {
    if (networkName === DOCKER_NETWORK_ISOLATED) {
        return {
            profileLabel: "public",
            dnsServers: [...DOCKER_DNS_PUBLIC_SERVERS]
        };
    }

    return {
        profileLabel: "default"
    };
}
