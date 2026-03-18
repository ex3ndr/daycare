export const INNGEST_ENDPOINT_ENV = "INNGEST_ENDPOINT";

export type DurableConfig = {
    endpoint: string;
};

/**
 * Resolves durable runtime configuration from process environment.
 * Expects: Inngest durable mode is enabled only when an endpoint is provided.
 */
export function durableConfigResolve(env: NodeJS.ProcessEnv): DurableConfig | null {
    const endpoint = env[INNGEST_ENDPOINT_ENV]?.trim() ?? "";

    if (!endpoint) {
        return null;
    }

    const url = new URL(endpoint);

    if (url.protocol === "ws:" || url.protocol === "wss:") {
        return {
            endpoint: url.toString()
        };
    }

    throw new Error("INNGEST_ENDPOINT must use ws or wss.");
}
