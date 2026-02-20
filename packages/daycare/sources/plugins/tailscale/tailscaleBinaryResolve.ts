import { access } from "node:fs/promises";

const TAILSCALE_APPSTORE_BINARY_PATH = "/Applications/Tailscale.app/Contents/MacOS/Tailscale";

/**
 * Resolves the tailscale executable path.
 * Expects: on macOS, App Store installs use the app bundle binary path.
 */
export async function tailscaleBinaryResolve(options?: {
    platform?: NodeJS.Platform;
    pathExists?: (value: string) => Promise<boolean>;
}): Promise<string> {
    const platform = options?.platform ?? process.platform;
    if (platform !== "darwin") {
        return "tailscale";
    }

    const pathExists = options?.pathExists ?? defaultPathExists;
    const appStoreBinaryExists = await pathExists(TAILSCALE_APPSTORE_BINARY_PATH);
    if (appStoreBinaryExists) {
        return TAILSCALE_APPSTORE_BINARY_PATH;
    }

    return "tailscale";
}

async function defaultPathExists(value: string): Promise<boolean> {
    try {
        await access(value);
        return true;
    } catch {
        return false;
    }
}
