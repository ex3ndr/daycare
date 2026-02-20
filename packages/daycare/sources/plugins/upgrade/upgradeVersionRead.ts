import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Reads the running Daycare package version from package.json.
 * Returns: null when package metadata cannot be read or is invalid.
 */
export async function upgradeVersionRead(): Promise<string | null> {
    const currentFile = fileURLToPath(import.meta.url);
    const packageJsonPath = path.resolve(path.dirname(currentFile), "../../../package.json");
    let raw = "";
    try {
        raw = await readFile(packageJsonPath, "utf8");
    } catch {
        return null;
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(raw) as unknown;
    } catch {
        return null;
    }
    if (!parsed || typeof parsed !== "object") {
        return null;
    }
    const version = (parsed as { version?: unknown }).version;
    if (typeof version !== "string" || version.trim().length === 0) {
        return null;
    }
    return version.trim();
}
