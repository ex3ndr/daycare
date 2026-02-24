type DockerContainerInspect = {
    NetworkSettings?: {
        Networks?: Record<string, unknown>;
    };
};

export type DockerContainerNetworkState = "correct" | "wrong";

/**
 * Resolves whether a container is attached only to the expected network.
 * Expects: details came from container.inspect().
 */
export function dockerContainerNetworkStateResolve(
    details: DockerContainerInspect,
    expectedNetworkName: string
): DockerContainerNetworkState {
    const configuredNetworks = details.NetworkSettings?.Networks;
    if (!configuredNetworks) {
        return "correct";
    }
    const networks = Object.keys(configuredNetworks);
    if (networks.length === 1 && networks[0] === expectedNetworkName) {
        return "correct";
    }
    return "wrong";
}
