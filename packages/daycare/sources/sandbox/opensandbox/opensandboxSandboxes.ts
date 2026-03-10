import { Sandbox as OpenSandbox } from "@alibaba-group/opensandbox";

import { getLogger } from "../../log.js";
import type { PathMountPoint } from "../../utils/pathMountTypes.js";
import type { SandboxOpenSandboxConfig } from "../sandboxTypes.js";

const logger = getLogger("sandbox.opensandbox");
const RENEW_WINDOW_MS = 60_000;

type OpenSandboxEntry = {
    fingerprint: string;
    sandbox: OpenSandbox;
    expiresAt: number;
};

/**
 * Facade for long-lived per-user OpenSandbox instances.
 * Expects: callers pass stable user-scoped config and mount lists for the same user.
 */
export class OpenSandboxSandboxes {
    private readonly sandboxesByUserId = new Map<string, OpenSandboxEntry>();
    private readonly ensureInFlight = new Map<string, Promise<OpenSandbox>>();

    async ensure(config: SandboxOpenSandboxConfig, mounts: PathMountPoint[]): Promise<OpenSandbox> {
        const pending = this.ensureInFlight.get(config.userId);
        if (pending) {
            return pending;
        }

        const operation = this.ensureInternal(config, mounts);
        this.ensureInFlight.set(config.userId, operation);
        try {
            return await operation;
        } finally {
            this.ensureInFlight.delete(config.userId);
        }
    }

    private async ensureInternal(config: SandboxOpenSandboxConfig, mounts: PathMountPoint[]): Promise<OpenSandbox> {
        const fingerprint = opensandboxFingerprintBuild(config, mounts);
        const existing = this.sandboxesByUserId.get(config.userId);
        if (!existing) {
            const created = await this.createEntry(config, mounts, fingerprint);
            this.sandboxesByUserId.set(config.userId, created);
            return created.sandbox;
        }

        if (existing.fingerprint !== fingerprint) {
            logger.warn({ userId: config.userId }, "stale: Replacing OpenSandbox because configuration changed");
            await this.disposeEntry(existing, true);
            const created = await this.createEntry(config, mounts, fingerprint);
            this.sandboxesByUserId.set(config.userId, created);
            return created.sandbox;
        }

        if (existing.expiresAt <= Date.now()) {
            logger.warn({ userId: config.userId }, "stale: Replacing expired OpenSandbox");
            await this.disposeEntry(existing, false);
            const created = await this.createEntry(config, mounts, fingerprint);
            this.sandboxesByUserId.set(config.userId, created);
            return created.sandbox;
        }

        if (existing.expiresAt - Date.now() <= renewWindowMs(config.timeoutSeconds)) {
            await existing.sandbox.renew(config.timeoutSeconds);
            existing.expiresAt = Date.now() + config.timeoutSeconds * 1000;
        }

        return existing.sandbox;
    }

    private async createEntry(
        config: SandboxOpenSandboxConfig,
        mounts: PathMountPoint[],
        fingerprint: string
    ): Promise<OpenSandboxEntry> {
        const sandbox = await OpenSandbox.create({
            connectionConfig: {
                domain: config.domain,
                apiKey: config.apiKey
            },
            image: config.image,
            timeoutSeconds: config.timeoutSeconds,
            metadata: {
                "daycare.backend": "opensandbox",
                "daycare.userId": config.userId
            },
            volumes: mounts.map((mount, index) => ({
                name: `daycare-mount-${index}`,
                host: { path: mount.hostPath },
                mountPath: mount.mappedPath,
                readOnly: mount.readOnly ?? mount.mappedPath !== "/home"
            }))
        });
        const info = await sandbox.getInfo();
        return {
            fingerprint,
            sandbox,
            expiresAt: info.expiresAt.getTime()
        };
    }

    private async disposeEntry(entry: OpenSandboxEntry, kill: boolean): Promise<void> {
        if (kill) {
            try {
                await entry.sandbox.kill();
            } catch (error) {
                logger.warn({ error }, "cleanup: Failed to kill stale OpenSandbox");
            }
        }
        try {
            await entry.sandbox.close();
        } catch (error) {
            logger.warn({ error }, "cleanup: Failed to close stale OpenSandbox client");
        }
    }
}

function renewWindowMs(timeoutSeconds: number): number {
    return Math.min(RENEW_WINDOW_MS, Math.max(1, Math.floor((timeoutSeconds * 1000) / 2)));
}

function opensandboxFingerprintBuild(config: SandboxOpenSandboxConfig, mounts: PathMountPoint[]): string {
    return JSON.stringify({
        domain: config.domain,
        apiKey: config.apiKey ?? null,
        image: config.image,
        timeoutSeconds: config.timeoutSeconds,
        mounts: mounts.map((mount) => ({
            hostPath: mount.hostPath,
            mappedPath: mount.mappedPath,
            readOnly: mount.readOnly ?? mount.mappedPath !== "/home"
        }))
    });
}
