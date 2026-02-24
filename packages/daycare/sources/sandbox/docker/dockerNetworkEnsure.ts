import type Docker from "dockerode";

type DockerError = {
    statusCode?: number;
};

type DockerNetworkOptions = {
    internal: boolean;
    enableIcc?: boolean;
};

/**
 * Ensures a named Docker bridge network exists with the requested options.
 * Expects: name is a stable network identifier and docker daemon is reachable.
 */
export async function dockerNetworkEnsure(docker: Docker, name: string, options: DockerNetworkOptions): Promise<void> {
    const existing = docker.getNetwork(name);
    try {
        await existing.inspect();
        return;
    } catch (error) {
        if ((error as DockerError).statusCode !== 404) {
            throw error;
        }
    }

    const networkOptions =
        options.enableIcc === undefined
            ? undefined
            : {
                  "com.docker.network.bridge.enable_icc": options.enableIcc ? "true" : "false"
              };

    try {
        await docker.createNetwork({
            Name: name,
            Driver: "bridge",
            Internal: options.internal,
            ...(networkOptions ? { Options: networkOptions } : {})
        });
    } catch (error) {
        if ((error as DockerError).statusCode !== 409) {
            throw error;
        }
    }
}
