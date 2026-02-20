import { mkdir, rm } from "node:fs/promises";

/**
 * Resets the output directory to an empty folder.
 * Expects: outDirectory can be removed and recreated on the host filesystem.
 */
export async function factoryOutDirectoryReset(outDirectory: string): Promise<void> {
    await rm(outDirectory, { recursive: true, force: true });
    await mkdir(outDirectory, { recursive: true });
}
