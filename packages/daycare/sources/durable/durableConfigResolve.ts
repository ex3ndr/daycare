export const INNGEST_ENDPOINT_ENV = "INNGEST_ENDPOINT";

export type DurableConfig = {
    apiBaseUrl: string;
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
            apiBaseUrl: durableApiBaseUrlResolve(url),
            endpoint: url.toString()
        };
    }

    throw new Error("INNGEST_ENDPOINT must use ws or wss.");
}

function durableApiBaseUrlResolve(url: URL): string {
    const apiUrl = new URL(url.toString());
    apiUrl.protocol = url.protocol === "wss:" ? "https:" : "http:";
    apiUrl.pathname = "/";
    apiUrl.search = "";
    apiUrl.hash = "";

    // Inngest self-hosting uses 8289 for the websocket gateway and 8288 for the HTTP API.
    if (apiUrl.port === "8289") {
        apiUrl.port = "8288";
    }

    return apiUrl.toString();
}
