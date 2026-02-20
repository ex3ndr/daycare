import { FACTORY_PI_DIR_MOUNT_PATH } from "../constants.js";

/**
 * Builds readonly docker bind mount string for host ~/.pi authentication data.
 * Expects: hostPiDirectory is an absolute path to an existing .pi folder.
 */
export function factoryContainerPiBindBuild(hostPiDirectory: string): string {
    return `${hostPiDirectory}:${FACTORY_PI_DIR_MOUNT_PATH}:ro`;
}
