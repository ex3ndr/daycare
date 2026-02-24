import type Docker from "dockerode";

import { dockerNetworkEnsure } from "./dockerNetworkEnsure.js";
import { DOCKER_NETWORK_ISOLATED, DOCKER_NETWORK_LOCAL } from "./dockerNetworkNames.js";

/**
 * Ensures Daycare sandbox Docker networks exist before container execution.
 * Expects: docker daemon is reachable and supports bridge networks.
 */
export async function dockerNetworksEnsure(docker: Docker): Promise<void> {
    await dockerNetworkEnsure(docker, DOCKER_NETWORK_ISOLATED, {
        internal: false,
        enableIcc: false
    });
    await dockerNetworkEnsure(docker, DOCKER_NETWORK_LOCAL, {
        internal: false
    });
}
