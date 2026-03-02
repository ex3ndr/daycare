import crypto from "node:crypto";

import { createId } from "@paralleldrive/cuid2";
import bcrypt from "bcryptjs";

import { getLogger } from "../../log.js";
import type { ExposeEndpointsRepository } from "../../storage/exposeEndpointsRepository.js";
import type { ObservationLogRepository } from "../../storage/observationLogRepository.js";
import { AsyncLock } from "../../utils/lock.js";
import type { ConfigModule } from "../config/configModule.js";
import type { EngineEventBus } from "../ipc/events.js";
import { TOPO_EVENT_TYPES, TOPO_SOURCE_EXPOSES, topographyObservationEmit } from "../observations/topographyEvents.js";
import { ExposeProxy } from "./exposeProxy.js";
import {
    type ExposeCreateInput,
    type ExposeEndpoint,
    type ExposeProviderRegistrationApi,
    type ExposeTunnelProvider,
    type ExposeUpdateInput,
    exposeCreateInputParse,
    exposeDomainNormalize,
    exposeModeSupported,
    exposeUpdateInputParse
} from "./exposeTypes.js";

const logger = getLogger("expose.facade");

type ExposeRuntimeEndpoint = ExposeEndpoint & { userId: string };

export type ExposesOptions = {
    config: ConfigModule;
    eventBus: EngineEventBus;
    exposeEndpoints: Pick<ExposeEndpointsRepository, "create" | "findAll" | "update" | "delete">;
    observationLog: ObservationLogRepository;
};

/**
 * Coordinates endpoint state, proxy routes, and tunnel providers.
 * Expects: providers are registered before `start()` for deterministic restore.
 */
export class Exposes implements ExposeProviderRegistrationApi {
    private readonly lock = new AsyncLock();
    private readonly proxy = new ExposeProxy();
    private readonly exposeEndpoints: Pick<ExposeEndpointsRepository, "create" | "findAll" | "update" | "delete">;
    private readonly observationLog: ObservationLogRepository;
    private readonly providers = new Map<string, ExposeTunnelProvider>();
    private readonly endpoints = new Map<string, ExposeRuntimeEndpoint>();
    private readonly activeDomains = new Map<string, string>();
    private proxyPort: number | null = null;
    private started = false;

    constructor(options: ExposesOptions) {
        void options.eventBus;
        this.exposeEndpoints = options.exposeEndpoints;
        this.observationLog = options.observationLog;
    }

    async start(): Promise<void> {
        await this.lock.inLock(async () => {
            if (this.started) {
                return;
            }

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

    async create(input: ExposeCreateInput, userId: string): Promise<{ endpoint: ExposeEndpoint; password?: string }> {
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
            const normalizedUserId = userId.trim();
            if (!normalizedUserId) {
                throw new Error("Expose user id is required.");
            }

            const now = Date.now();
            const id = createId();
            const auth = normalizedInput.authenticated ? await authEntryCreate() : null;

            let endpoint: ExposeRuntimeEndpoint | null = null;
            let tunnelDomain: string | null = null;
            let normalizedDomain: string | null = null;
            try {
                const tunnel = await provider.createTunnel(this.proxyPort, normalizedInput.mode, normalizedUserId);
                tunnelDomain = tunnel.domain;
                normalizedDomain = exposeDomainNormalize(tunnel.domain);
                endpoint = {
                    id,
                    userId: normalizedUserId,
                    target: normalizedInput.target,
                    provider: provider.instanceId,
                    domain: normalizedDomain,
                    mode: normalizedInput.mode,
                    auth: auth ? { enabled: true, passwordHash: auth.passwordHash } : null,
                    createdAt: now,
                    updatedAt: now
                };

                this.proxy.addRoute(normalizedDomain, endpoint.target, endpoint.auth?.passwordHash);
                this.endpoints.set(id, cloneRuntimeEndpoint(endpoint));
                this.activeDomains.set(id, normalizedDomain);
                await this.exposeEndpoints.create(endpointRecordBuild(endpoint));
                await topographyObservationEmit(this.observationLog, {
                    userId: normalizedUserId,
                    type: TOPO_EVENT_TYPES.EXPOSE_CREATED,
                    source: TOPO_SOURCE_EXPOSES,
                    message: `Expose created: ${endpoint.domain}`,
                    details: `Expose endpoint ${endpoint.id} created for domain "${endpoint.domain}" via ${endpoint.provider} (${endpoint.mode})`,
                    data: {
                        exposeId: endpoint.id,
                        userId: normalizedUserId,
                        domain: endpoint.domain,
                        target: JSON.stringify(endpoint.target),
                        provider: endpoint.provider,
                        mode: endpoint.mode,
                        authenticated: endpoint.auth !== null
                    },
                    scopeIds: [normalizedUserId]
                });
                return {
                    endpoint: cloneEndpoint(endpoint),
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
            await this.exposeEndpoints.delete(endpoint.id);
            await topographyObservationEmit(this.observationLog, {
                userId: endpoint.userId,
                type: TOPO_EVENT_TYPES.EXPOSE_REMOVED,
                source: TOPO_SOURCE_EXPOSES,
                message: `Expose removed: ${endpoint.domain}`,
                details: `Expose endpoint ${endpoint.id} removed for domain "${endpoint.domain}"`,
                data: {
                    exposeId: endpoint.id,
                    userId: endpoint.userId,
                    domain: endpoint.domain
                },
                scopeIds: [endpoint.userId]
            });
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

            const updated: ExposeRuntimeEndpoint = {
                ...current,
                auth: auth ? { enabled: true, passwordHash: auth.passwordHash } : null,
                updatedAt: Date.now()
            };

            if (domain) {
                this.proxy.updateRoute(domain, {
                    passwordHash: updated.auth?.passwordHash ?? null
                });
            }
            this.endpoints.set(updated.id, cloneRuntimeEndpoint(updated));
            await this.exposeEndpoints.update(updated.id, endpointRecordBuild(updated));
            await topographyObservationEmit(this.observationLog, {
                userId: updated.userId,
                type: TOPO_EVENT_TYPES.EXPOSE_UPDATED,
                source: TOPO_SOURCE_EXPOSES,
                message: `Expose updated: ${updated.domain}`,
                details: `Expose endpoint ${updated.id} updated for domain "${updated.domain}"`,
                data: {
                    exposeId: updated.id,
                    userId: updated.userId,
                    domain: updated.domain,
                    target: JSON.stringify(updated.target),
                    provider: updated.provider,
                    mode: updated.mode,
                    authenticated: updated.auth !== null
                },
                scopeIds: [updated.userId]
            });

            return {
                endpoint: cloneEndpoint(updated),
                password: nextPassword
            };
        });
    }

    async list(): Promise<ExposeEndpoint[]> {
        return Array.from(this.endpoints.values())
            .map((endpoint) => cloneEndpoint(endpoint))
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
        const rows = await this.exposeEndpoints.findAll();
        for (const row of rows) {
            this.endpoints.set(row.id, endpointFromRecord(row));
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
            const tunnel = await provider.createTunnel(this.proxyPort, endpoint.mode, endpoint.userId);
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

            const updated: ExposeRuntimeEndpoint = {
                ...endpoint,
                domain,
                updatedAt: Date.now()
            };
            this.endpoints.set(updated.id, cloneRuntimeEndpoint(updated));
            await this.exposeEndpoints.update(updated.id, endpointRecordBuild(updated));
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
}

async function authEntryCreate(): Promise<{ password: string; passwordHash: string }> {
    const password = crypto.randomBytes(32).toString("base64url");
    const passwordHash = await bcrypt.hash(password, 10);
    return { password, passwordHash };
}

function endpointFromRecord(record: {
    id: string;
    userId: string;
    target: ExposeRuntimeEndpoint["target"];
    provider: string;
    domain: string;
    mode: ExposeRuntimeEndpoint["mode"];
    auth: ExposeRuntimeEndpoint["auth"];
    createdAt: number;
    updatedAt: number;
}): ExposeRuntimeEndpoint {
    return {
        id: record.id,
        userId: record.userId,
        target: record.target,
        provider: record.provider,
        domain: record.domain,
        mode: record.mode,
        auth: record.auth,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt
    };
}

function endpointRecordBuild(endpoint: ExposeRuntimeEndpoint): {
    id: string;
    userId: string;
    target: ExposeRuntimeEndpoint["target"];
    provider: string;
    domain: string;
    mode: ExposeRuntimeEndpoint["mode"];
    auth: ExposeRuntimeEndpoint["auth"];
    createdAt: number;
    updatedAt: number;
} {
    return {
        id: endpoint.id,
        userId: endpoint.userId,
        target: endpoint.target,
        provider: endpoint.provider,
        domain: endpoint.domain,
        mode: endpoint.mode,
        auth: endpoint.auth,
        createdAt: endpoint.createdAt,
        updatedAt: endpoint.updatedAt
    };
}

function cloneRuntimeEndpoint(endpoint: ExposeRuntimeEndpoint): ExposeRuntimeEndpoint {
    return {
        ...endpoint,
        target: JSON.parse(JSON.stringify(endpoint.target)) as ExposeRuntimeEndpoint["target"],
        auth: endpoint.auth ? { ...endpoint.auth } : null
    };
}

function cloneEndpoint(endpoint: ExposeRuntimeEndpoint): ExposeEndpoint {
    return {
        id: endpoint.id,
        target: JSON.parse(JSON.stringify(endpoint.target)) as ExposeRuntimeEndpoint["target"],
        provider: endpoint.provider,
        domain: endpoint.domain,
        mode: endpoint.mode,
        auth: endpoint.auth ? { ...endpoint.auth } : null,
        createdAt: endpoint.createdAt,
        updatedAt: endpoint.updatedAt
    };
}
