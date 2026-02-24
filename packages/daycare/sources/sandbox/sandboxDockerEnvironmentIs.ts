import { constants } from "node:fs";
import { access, readFile } from "node:fs/promises";

/**
 * Detects whether the current runtime is executing inside a container.
 * Expects: Docker-like environments expose /.dockerenv or container markers in /proc/1/cgroup.
 */
export async function sandboxDockerEnvironmentIs(): Promise<boolean> {
    const dockerenvExists = await access("/.dockerenv", constants.R_OK)
        .then(() => true)
        .catch(() => false);
    if (dockerenvExists) {
        return true;
    }

    const cgroup = await readFile("/proc/1/cgroup", "utf-8").catch(() => "");
    return /(docker|containerd|kubepods|podman)/i.test(cgroup);
}
