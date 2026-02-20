import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import { createId } from "@paralleldrive/cuid2";
import bcrypt from "bcryptjs";

import { getLogger } from "../../log.js";
import { atomicWrite } from "../../util/atomicWrite.js";
import { AsyncLock } from "../../util/lock.js";
import type { ConfigModule } from "../config/configModule.js";
import type { EngineEventBus } from "../ipc/events.js";
import { ExposeProxy } from "./exposeProxy.js";
import {
    type ExposeCreateInput,
    type ExposeEndpoint,
    type ExposeProviderRegistrationApi,
    type ExposeTunnelProvider,
    type ExposeUpdateInput,
    exposeCreateInputParse,
    exposeDomainNormalize,
    exposeEndpointParse,
    exposeModeSupported,
    exposeUpdateInputParse
} from "./exposeTypes.js";

const logger = getLogger("expose.facade");

export type ExposesOptions = {
    config: ConfigModule;
    eventBus: EngineEventBus;
};

/**
 * Coordinates endpoint state, proxy routes, and tunnel providers.
 * Expects: providers are registered before `start()` for deterministic restore.
 */
export class Exposes implements ExposeProviderRegistrationApi {
    private readonly baseDir: string;
    private readonly endpointsDir: string;
    private readonly lock = new AsyncLock();
    private readonly proxy = new ExposeProxy();
    private readonly providers = new Map<string, ExposeTunnelProvider>();
    private readonly endpoints = new Map<string, ExposeEndpoint>();
    private readonly activeDomains = new Map<string, string>();
    private proxyPort: number | null = null;
    private started = false;

    constructor(options: ExposesOptions) {
        this.baseDir = path.join(options.config.current.configDir, "expose");
        this.endpointsDir = path.join(this.baseDir, "endpoints");
    }

    async ensureDir(): Promise<void> {
        await fs.mkdir(this.endpointsDir, { recursive: true });
    }

    async start(): Promise<void> {
        await this.lock.inLock(async () => {
            if (this.started) {
                return;
            }

            await this.ensureDir();
            const { port } = await this.proxy.start();
            this.proxyPort = port;
            this.started = true;

            await this.endpointsLoad();
            for (const endpoint of this.endpoints.values()) {
                await this.endpointActivate(endpoint.id);
            }
        });
    }

    async stop(): Promise<void> {
        await this.lock.inLock(async () => {
            if (!this.started) {
                return;
            }

            for (const endpoint of this.endpoints.values()) {
                await this.endpointDeactivate(endpoint.id);
            }

            await this.proxy.stop();
            this.proxyPort = null;
            this.started = false;
        });
    }

    async registerProvider(provider: ExposeTunnelProvider): Promise<void> {
        await this.lock.inLock(async () => {
            const instanceId = provider.instanceId.trim();
            if (!instanceId) {
                throw new Error("Expose provider instanceId is required.");
            }
            if (this.providers.has(instanceId)) {
                throw new Error(`Expose provider already registered: ${instanceId}`);
            }

            this.providers.set(instanceId, {
                ...provider,
                instanceId,
                domain: exposeDomainNormalize(provider.domain)
            });

            if (!this.started) {
                return;
            }
            for (const endpoint of this.endpoints.values()) {
                if (endpoint.provider !== instanceId || this.activeDomains.has(endpoint.id)) {
                    continue;
                }
                await this.endpointActivate(endpoint.id);
            }
        });
    }

    async unregisterProvider(instanceId: string): Promise<void> {
        await this.lock.inLock(async () => {
            const providerId = instanceId.trim();
            if (!providerId) {
                return;
            }

            for (const endpoint of this.endpoints.values()) {
                if (endpoint.provider !== providerId) {
                    continue;
                }
                await this.endpointDeactivate(endpoint.id);
            }

            this.providers.delete(providerId);
        });
    }

    listProviders(): Array<{
        instanceId: string;
        domain: string;
        capabilities: { public: boolean; localNetwork: boolean };
    }> {
        return Array.from(this.providers.values())
            .map((provider) => ({
                instanceId: provider.instanceId,
                domain: provider.domain,
                capabilities: {
                    public: provider.capabilities.public,
                    localNetwork: provider.capabilities.localNetwork
                }
            }))
            .sort((left, right) => left.instanceId.localeCompare(right.instanceId));
    }

    async create(input: ExposeCreateInput): Promise<{ endpoint: ExposeEndpoint; password?: string }> {
        return this.lock.inLock(async () => {
            if (!this.started || this.proxyPort === null) {
                throw new Error("Expose module is not started.");
            }

            const normalizedInput = exposeCreateInputParse(input);
            const provider = this.providerSelect(normalizedInput.provider);
            if (!exposeModeSupported(normalizedInput.mode, provider.capabilities)) {
                throw new Error(
                    `Expose provider ${provider.instanceId} does not support ${normalizedInput.mode} mode.`
                );
            }

            const now = Date.now();
            const id = createId();
            const auth = normalizedInput.authenticated ? await authEntryCreate() : null;
            let endpoint: ExposeEndpoint | null = null;
            let tunnelDomain: string | null = null;
            let normalizedDomain: string | null = null;
            try {
                const tunnel = await provider.createTunnel(this.proxyPort, normalizedInput.mode);
                tunnelDomain = tunnel.domain;
                normalizedDomain = exposeDomainNormalize(tunnel.domain);
                endpoint = {
                    id,
                    target: normalizedInput.target,
                    provider: provider.instanceId,
                    domain: normalizedDomain,
                    mode: normalizedInput.mode,
                    auth: auth ? { enabled: true, passwordHash: auth.passwordHash } : null,
                    createdAt: now,
                    updatedAt: now
                };

                this.proxy.addRoute(normalizedDomain, endpoint.target, endpoint.auth?.passwordHash);
                this.endpoints.set(id, structuredClone(endpoint));
                this.activeDomains.set(id, normalizedDomain);
                await this.endpointWrite(endpoint);
                return {
                    endpoint: structuredClone(endpoint),
                    password: auth?.password
                };
            } catch (error) {
                if (normalizedDomain) {
                    this.proxy.removeRoute(normalizedDomain);
                    this.activeDomains.delete(id);
                }
                this.endpoints.delete(id);
                const destroyDomain = tunnelDomain ?? normalizedDomain;
                if (destroyDomain) {
                    await provider.destroyTunnel(destroyDomain).catch((destroyError) => {
                        logger.warn(
                            { endpointId: id, provider: provider.instanceId, destroyError },
                            "error: Expose create rollback failed"
                        );
                    });
                }
                throw error;
            }
        });
    }

    async remove(endpointId: string): Promise<void> {
        await this.lock.inLock(async () => {
            const endpoint = this.endpoints.get(endpointId);
            if (!endpoint) {
                throw new Error(`Expose endpoint not found: ${endpointId}`);
            }

            await this.endpointDeactivate(endpoint.id);
            this.endpoints.delete(endpoint.id);
            await this.endpointDelete(endpoint.id);
        });
    }

    async update(
        endpointId: string,
        input: ExposeUpdateInput
    ): Promise<{ endpoint: ExposeEndpoint; password?: string }> {
        return this.lock.inLock(async () => {
            const endpoint = this.endpoints.get(endpointId);
            if (!endpoint) {
                throw new Error(`Expose endpoint not found: ${endpointId}`);
            }

            const normalizedInput = exposeUpdateInputParse(input);

            let nextPassword: string | undefined;
            const auth = normalizedInput.authenticated ? await authEntryCreate() : null;
            if (auth) {
                nextPassword = auth.password;
            }

            let domain = this.activeDomains.get(endpoint.id) ?? null;
            if (!domain && this.started) {
                await this.endpointActivate(endpoint.id, {
                    passwordHash: auth?.passwordHash ?? null
                });
                domain = this.activeDomains.get(endpoint.id) ?? null;
            }
            const current = this.endpoints.get(endpoint.id);
            if (!current) {
                throw new Error(`Expose endpoint not found: ${endpoint.id}`);
            }

            const updated: ExposeEndpoint = {
                ...current,
                auth: auth ? { enabled: true, passwordHash: auth.passwordHash } : null,
                updatedAt: Date.now()
            };

            if (domain) {
                this.proxy.updateRoute(domain, {
                    passwordHash: updated.auth?.passwordHash ?? null
                });
            }
            this.endpoints.set(updated.id, structuredClone(updated));
            await this.endpointWrite(updated);

            return {
                endpoint: structuredClone(updated),
                password: nextPassword
            };
        });
    }

    async list(): Promise<ExposeEndpoint[]> {
        return Array.from(this.endpoints.values())
            .map((endpoint) => structuredClone(endpoint))
            .sort((left, right) => left.createdAt - right.createdAt);
    }

    private providerSelect(requested?: string): ExposeTunnelProvider {
        const requestedId = requested?.trim();
        if (requestedId) {
            const selected = this.providers.get(requestedId);
            if (!selected) {
                throw new Error(`Expose provider not found: ${requestedId}`);
            }
            return selected;
        }

        const all = Array.from(this.providers.values());
        if (all.length === 0) {
            throw new Error("No expose tunnel providers are configured.");
        }
        if (all.length > 1) {
            throw new Error("Multiple expose providers are configured. Specify provider.");
        }

        const selected = all[0];
        if (!selected) {
            throw new Error("No expose tunnel providers are configured.");
        }
        return selected;
    }

    private async endpointsLoad(): Promise<void> {
        this.endpoints.clear();
        const entries = await fs.readdir(this.endpointsDir, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isFile() || !entry.name.endsWith(".json")) {
                continue;
            }
            const endpointId = entry.name.slice(0, -5);
            if (!endpointId) {
                continue;
            }
            try {
                const endpoint = await this.endpointRead(endpointId);
                if (!endpoint) {
                    continue;
                }
                this.endpoints.set(endpoint.id, endpoint);
            } catch (error) {
                logger.warn({ endpointId, error }, "skip: Failed to restore expose endpoint");
            }
        }
    }

    private async endpointActivate(endpointId: string, options?: { passwordHash?: string | null }): Promise<void> {
        if (!this.started || this.proxyPort === null) {
            return;
        }

        const endpoint = this.endpoints.get(endpointId);
        if (!endpoint || this.activeDomains.has(endpointId)) {
            return;
        }

        const provider = this.providers.get(endpoint.provider);
        if (!provider) {
            logger.warn(
                { endpointId, provider: endpoint.provider },
                "skip: Expose endpoint skipped, provider unavailable"
            );
            return;
        }

        if (!exposeModeSupported(endpoint.mode, provider.capabilities)) {
            logger.warn(
                { endpointId, provider: endpoint.provider, mode: endpoint.mode },
                "skip: Expose endpoint skipped, mode unsupported by provider"
            );
            return;
        }

        let tunnelDomain: string | null = null;
        let domain: string | null = null;
        try {
            const tunnel = await provider.createTunnel(this.proxyPort, endpoint.mode);
            tunnelDomain = tunnel.domain;
            domain = exposeDomainNormalize(tunnel.domain);

            const routePasswordHash =
                options && "passwordHash" in options
                    ? (options.passwordHash ?? undefined)
                    : (endpoint.auth?.passwordHash ?? undefined);
            this.proxy.addRoute(domain, endpoint.target, routePasswordHash);
            this.activeDomains.set(endpointId, domain);

            if (endpoint.domain === domain) {
                return;
            }

            const updated: ExposeEndpoint = {
                ...endpoint,
                domain,
                updatedAt: Date.now()
            };
            this.endpoints.set(updated.id, structuredClone(updated));
            await this.endpointWrite(updated);
        } catch (error) {
            if (domain) {
                this.proxy.removeRoute(domain);
                this.activeDomains.delete(endpointId);
            }
            const destroyDomain = tunnelDomain ?? domain;
            if (destroyDomain) {
                await provider.destroyTunnel(destroyDomain).catch((destroyError) => {
                    logger.warn(
                        { endpointId, provider: endpoint.provider, destroyError },
                        "error: Expose restore rollback failed"
                    );
                });
            }
            throw error;
        }
    }

    private async endpointDeactivate(endpointId: string): Promise<void> {
        const endpoint = this.endpoints.get(endpointId);
        if (!endpoint) {
            return;
        }

        const activeDomain = this.activeDomains.get(endpointId);
        if (!activeDomain) {
            return;
        }

        const provider = this.providers.get(endpoint.provider);
        if (provider) {
            await provider.destroyTunnel(activeDomain).catch((error) => {
                logger.warn(
                    { endpointId, provider: endpoint.provider, error },
                    "error: Failed to destroy expose tunnel"
                );
            });
        }

        this.proxy.removeRoute(activeDomain);
        this.activeDomains.delete(endpointId);
    }

    private endpointPathBuild(endpointId: string): string {
        return path.join(this.endpointsDir, `${endpointId}.json`);
    }

    private async endpointRead(endpointId: string): Promise<ExposeEndpoint | null> {
        const filePath = this.endpointPathBuild(endpointId);
        let raw = "";
        try {
            raw = await fs.readFile(filePath, "utf8");
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === "ENOENT") {
                return null;
            }
            throw error;
        }
        return exposeEndpointParse(JSON.parse(raw));
    }

    private async endpointWrite(endpoint: ExposeEndpoint): Promise<void> {
        const payload = exposeEndpointParse(endpoint);
        await atomicWrite(this.endpointPathBuild(endpoint.id), `${JSON.stringify(payload, null, 2)}\n`);
    }

    private async endpointDelete(endpointId: string): Promise<void> {
        await fs.rm(this.endpointPathBuild(endpointId), { force: true });
    }
}

async function authEntryCreate(): Promise<{ password: string; passwordHash: string }> {
    const password = crypto.randomBytes(32).toString("base64url");
    const passwordHash = await bcrypt.hash(password, 10);
    return { password, passwordHash };
}
