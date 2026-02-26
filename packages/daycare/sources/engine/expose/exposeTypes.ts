import { z } from "zod";

const EXPOSE_DOMAIN_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

export type ExposeTarget =
    | {
          type: "port";
          port: number;
      }
    | {
          type: "unix";
          path: string;
      };

export type ExposeMode = "public" | "local-network";

export type ExposeEndpointAuth = {
    enabled: true;
    passwordHash: string;
};

export type ExposeEndpoint = {
    id: string;
    target: ExposeTarget;
    provider: string;
    domain: string;
    mode: ExposeMode;
    auth: ExposeEndpointAuth | null;
    createdAt: number;
    updatedAt: number;
};

export type ExposeTunnelProvider = {
    instanceId: string;
    domain: string;
    capabilities: {
        public: boolean;
        localNetwork: boolean;
    };
    createTunnel: (proxyPort: number, mode: ExposeMode, userId: string) => Promise<{ domain: string }>;
    destroyTunnel: (domain: string) => Promise<void>;
};

export type ExposeCreateInput = {
    target: ExposeTarget;
    provider?: string;
    mode: ExposeMode;
    authenticated: boolean;
};

export type ExposeUpdateInput = {
    authenticated: boolean;
};

export type ExposeProviderRegistrationApi = {
    registerProvider: (provider: ExposeTunnelProvider) => Promise<void>;
    unregisterProvider: (instanceId: string) => Promise<void>;
    listProviders: () => Array<{
        instanceId: string;
        domain: string;
        capabilities: {
            public: boolean;
            localNetwork: boolean;
        };
    }>;
};

const exposeTargetSchema = z.discriminatedUnion("type", [
    z
        .object({
            type: z.literal("port"),
            port: z.number().int().min(1).max(65535)
        })
        .strict(),
    z
        .object({
            type: z.literal("unix"),
            path: z.string().trim().min(1)
        })
        .strict()
]);

const exposeModeSchema = z.union([z.literal("public"), z.literal("local-network")]);

const exposeCreateInputSchema = z
    .object({
        target: exposeTargetSchema,
        provider: z.string().trim().min(1).optional(),
        mode: exposeModeSchema,
        authenticated: z.boolean()
    })
    .strict();

const exposeUpdateInputSchema = z
    .object({
        authenticated: z.boolean()
    })
    .strict();

const exposeEndpointSchema = z
    .object({
        id: z.string().trim().min(1),
        target: exposeTargetSchema,
        provider: z.string().trim().min(1),
        domain: z.string().trim().min(1),
        mode: exposeModeSchema,
        auth: z
            .object({
                enabled: z.literal(true),
                passwordHash: z.string().trim().min(1)
            })
            .strict()
            .nullable(),
        createdAt: z.number().int().nonnegative(),
        updatedAt: z.number().int().nonnegative()
    })
    .strict();

/**
 * Validates and normalizes an expose target payload.
 * Expects: value is either a port target or unix socket target.
 */
export function exposeTargetParse(value: unknown): ExposeTarget {
    return exposeTargetSchema.parse(value) as ExposeTarget;
}

/**
 * Validates and normalizes expose create arguments.
 * Expects: mode and target are provided.
 */
export function exposeCreateInputParse(value: unknown): ExposeCreateInput {
    const parsed = exposeCreateInputSchema.parse(value) as ExposeCreateInput;
    return {
        ...parsed,
        provider: parsed.provider?.trim()
    };
}

/**
 * Validates expose update arguments.
 * Expects: authenticated boolean is present.
 */
export function exposeUpdateInputParse(value: unknown): ExposeUpdateInput {
    return exposeUpdateInputSchema.parse(value) as ExposeUpdateInput;
}

/**
 * Validates a persisted endpoint object.
 * Expects: timestamps are unix milliseconds.
 */
export function exposeEndpointParse(value: unknown): ExposeEndpoint {
    const parsed = exposeEndpointSchema.parse(value) as ExposeEndpoint;
    return {
        ...parsed,
        domain: exposeDomainNormalize(parsed.domain)
    };
}

/**
 * Normalizes and validates a DNS host value.
 * Expects: domain is a fully-qualified hostname.
 */
export function exposeDomainNormalize(domain: string): string {
    const normalized = domain.trim().toLowerCase();
    if (!EXPOSE_DOMAIN_PATTERN.test(normalized)) {
        throw new Error(`Invalid expose domain: ${domain}`);
    }
    return normalized;
}

/**
 * Validates that a mode is supported by provider capabilities.
 * Expects: provider capability flags are explicit booleans.
 */
export function exposeModeSupported(
    mode: ExposeMode,
    capabilities: { public: boolean; localNetwork: boolean }
): boolean {
    if (mode === "public") {
        return capabilities.public;
    }
    return capabilities.localNetwork;
}
