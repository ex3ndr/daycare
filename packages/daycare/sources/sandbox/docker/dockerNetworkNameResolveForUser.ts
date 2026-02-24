import { DOCKER_NETWORK_ISOLATED, DOCKER_NETWORK_LOCAL } from "./dockerNetworkNames.js";

/**
 * Resolves which Docker network a sandbox user should run on.
 * Expects: allowLocalNetworkingForUsers contains normalized user ids.
 */
export function dockerNetworkNameResolveForUser(userId: string, allowLocalNetworkingForUsers: string[]): string {
    if (allowLocalNetworkingForUsers.includes(userId)) {
        return DOCKER_NETWORK_LOCAL;
    }
    return DOCKER_NETWORK_ISOLATED;
}
