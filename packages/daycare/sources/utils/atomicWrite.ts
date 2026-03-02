import { promises as fs } from "node:fs";

/**
 * Writes a file atomically by renaming a temp file into place.
 * Expects: parent directories exist and payload is fully serialized.
 */
export async function atomicWrite(filePath: string, payload: string): Promise<void> {
    const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
    await fs.writeFile(tempPath, payload, { mode: 0o600 });
    await fs.rename(tempPath, filePath);
}
