import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";

/**
 * Resolves and validates the host ~/.pi directory for docker auth mounting.
 * Expects: host machine has pi auth files under ~/.pi/agent/auth.json.
 */
export async function factoryPiDirectoryResolve(): Promise<string> {
    const piDirectory = resolve(homedir(), ".pi");

    await access(piDirectory, constants.R_OK).catch(() => {
        throw new Error(`Pi auth directory is required but missing or unreadable: ${piDirectory}`);
    });

    return piDirectory;
}
