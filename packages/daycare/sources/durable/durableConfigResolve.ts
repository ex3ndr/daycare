export const INNGEST_ENDPOINT_ENV = "INNGEST_ENDPOINT";
export const INNGEST_TOKEN_ENV = "INNGEST_TOKEN";

export type DurableConfig = {
    endpoint: string;
    token: string;
    apiUrl: string;
    gatewayUrl: string;
};

/**
 * Resolves durable runtime configuration from process environment.
 * Expects: Inngest durable mode is enabled only when both endpoint and token are provided.
 */
export function durableConfigResolve(env: NodeJS.ProcessEnv): DurableConfig | null {
    const endpoint = env[INNGEST_ENDPOINT_ENV]?.trim() ?? "";
    const token = env[INNGEST_TOKEN_ENV]?.trim() ?? "";

    if (!endpoint && !token) {
        return null;
    }
    if (!endpoint || !token) {
        throw new Error("INNGEST_ENDPOINT and INNGEST_TOKEN must both be set to enable durable runtime.");
    }

    return {
        endpoint,
        token,
        ...durableEndpointUrlsResolve(endpoint)
    };
}

function durableEndpointUrlsResolve(endpoint: string): { apiUrl: string; gatewayUrl: string } {
    const url = new URL(endpoint);

    if (url.protocol === "http:") {
        return {
            apiUrl: url.toString(),
            gatewayUrl: url.toString().replace(/^http:/, "ws:")
        };
    } else if (url.protocol === "https:") {
        return {
            apiUrl: url.toString(),
            gatewayUrl: url.toString().replace(/^https:/, "wss:")
        };
    }
    if (url.protocol === "ws:") {
        return {
            apiUrl: url.toString().replace(/^ws:/, "http:"),
            gatewayUrl: url.toString()
        };
    }
    if (url.protocol === "wss:") {
        return {
            apiUrl: url.toString().replace(/^wss:/, "https:"),
            gatewayUrl: url.toString()
        };
    }
    throw new Error("INNGEST_ENDPOINT must use http, https, ws, or wss.");
}
