import type { PathMountPoint } from "../utils/pathMountTypes.js";
import { DockerExecBackend } from "./docker/dockerExecBackend.js";
import { OpenSandboxExecBackend } from "./opensandbox/opensandboxExecBackend.js";
import type { SandboxExecBackend } from "./sandboxExecBackendTypes.js";
import type { SandboxBackendConfig } from "./sandboxTypes.js";

/**
 * Creates the concrete exec backend for a sandbox instance.
 * Expects: homeDir is the resolved host home path and mounts already include /home.
 */
export function sandboxExecBackendBuild(
    backend: SandboxBackendConfig,
    homeDir: string,
    mounts: PathMountPoint[]
): SandboxExecBackend {
    if (backend.type === "docker") {
        return new DockerExecBackend({
            homeDir,
            mounts,
            docker: backend.docker
        });
    }
    return new OpenSandboxExecBackend(backend.opensandbox, mounts);
}
