import { appEndpointNormalize } from "./appEndpointNormalize.js";

export type AppRequestEndpointHeaders =
    | Headers
    | Record<string, string | string[] | undefined>
    | Array<[string, string]>;

export type AppRequestEndpointsResolveInput = {
    host: string;
    port: number;
    appEndpoint?: string;
    serverEndpoint?: string;
    headers?: AppRequestEndpointHeaders;
};

export type AppRequestEndpoints = {
    appEndpoint: string;
    serverEndpoint: string;
};

/**
 * Resolves public app/api endpoints for auth links from config and request headers.
 * Expects: host and port describe the local app-server listener; configured endpoints are absolute origins when set.
 */
export function appRequestEndpointsResolve(input: AppRequestEndpointsResolveInput): AppRequestEndpoints {
    const configuredAppEndpoint = appEndpointNormalize(input.appEndpoint, "appEndpoint");
    const configuredServerEndpoint = appEndpointNormalize(input.serverEndpoint, "serverEndpoint");
    const headers = headersNormalize(input.headers);
    const requestAppEndpoint = requestAppEndpointResolve(headers);
    const requestServerEndpoint = requestServerEndpointResolve(headers);
    const fallbackServerEndpoint = `http://${input.host.trim()}:${input.port}`;
    const serverEndpoint = configuredServerEndpoint ?? requestServerEndpoint ?? fallbackServerEndpoint;
    const appEndpoint = configuredAppEndpoint ?? requestAppEndpoint ?? serverEndpoint;

    return {
        appEndpoint,
        serverEndpoint
    };
}

function headersNormalize(headers: AppRequestEndpointHeaders | undefined): Headers {
    if (headers instanceof Headers) {
        return headers;
    }

    if (Array.isArray(headers)) {
        return new Headers(headers);
    }

    const normalized = new Headers();
    if (!headers) {
        return normalized;
    }

    for (const [key, value] of Object.entries(headers)) {
        if (typeof value === "string") {
            normalized.set(key, value);
            continue;
        }
        if (Array.isArray(value) && value.length > 0) {
            normalized.set(key, value.join(", "));
        }
    }

    return normalized;
}

function requestAppEndpointResolve(headers: Headers): string | undefined {
    return endpointOriginParse(headers.get("origin")) ?? endpointOriginParse(headers.get("referer"));
}

function requestServerEndpointResolve(headers: Headers): string | undefined {
    const forwardedHost = forwardedValueFirst(headers.get("x-forwarded-host"));
    const forwardedProto = forwardedValueFirst(headers.get("x-forwarded-proto"));
    if (forwardedHost) {
        return endpointOriginBuild(forwardedProto ?? "http", forwardedHost);
    }

    const host = forwardedValueFirst(headers.get("host"));
    if (!host) {
        return undefined;
    }

    const originProtocol = endpointProtocolParse(headers.get("origin"));
    const refererProtocol = endpointProtocolParse(headers.get("referer"));
    return endpointOriginBuild(forwardedProto ?? originProtocol ?? refererProtocol ?? "http", host);
}

function forwardedValueFirst(value: string | null): string | undefined {
    const first = value
        ?.split(",")
        .map((entry) => entry.trim())
        .find((entry) => entry.length > 0);
    return first || undefined;
}

function endpointProtocolParse(value: string | null): string | undefined {
    if (!value) {
        return undefined;
    }
    try {
        const parsed = new URL(value);
        return parsed.protocol.replace(":", "");
    } catch {
        return undefined;
    }
}

function endpointOriginParse(value: string | null): string | undefined {
    if (!value) {
        return undefined;
    }
    try {
        const parsed = new URL(value);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
            return undefined;
        }
        return `${parsed.protocol}//${parsed.host}`;
    } catch {
        return undefined;
    }
}

function endpointOriginBuild(protocol: string, host: string): string | undefined {
    const normalizedProtocol = protocol.trim().replace(/:$/, "");
    const normalizedHost = host.trim();
    if (!normalizedProtocol || !normalizedHost) {
        return undefined;
    }
    return endpointOriginParse(`${normalizedProtocol}://${normalizedHost}`);
}
