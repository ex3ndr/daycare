import type { PathMountPoint } from "../../utils/pathMountTypes.js";
import type { SandboxOpenSandboxConfig } from "../sandboxTypes.js";
import { opensandboxSandboxesShared } from "./opensandboxSandboxesShared.js";

/**
 * Resolves the long-lived OpenSandbox instance for a user, creating or renewing it as needed.
 * Expects: config.userId scopes the sandbox identity and mounts is the complete sandbox mount list.
 */
export async function opensandboxSandboxEnsure(config: SandboxOpenSandboxConfig, mounts: PathMountPoint[]) {
    return opensandboxSandboxesShared.ensure(config, mounts);
}
