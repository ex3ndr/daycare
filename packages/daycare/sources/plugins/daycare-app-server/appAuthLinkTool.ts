import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";
import type { ToolDefinition, ToolResultContract } from "@/types";
import { jwtSign } from "../../util/jwt.js";

export const APP_AUTH_EXPIRES_IN_SECONDS = 3600;

const appAuthLinkToolSchema = Type.Object({}, { additionalProperties: false });
type AppAuthLinkArgs = Static<typeof appAuthLinkToolSchema>;

const appAuthLinkResultSchema = Type.Object(
    {
        url: Type.String(),
        token: Type.String(),
        userId: Type.String(),
        expiresAt: Type.Number()
    },
    { additionalProperties: false }
);

type AppAuthLinkResult = Static<typeof appAuthLinkResultSchema>;

const appAuthLinkReturns: ToolResultContract<AppAuthLinkResult> = {
    schema: appAuthLinkResultSchema,
    toLLMText: (result) => `Open Daycare app: ${result.url}`
};

export type AppAuthLinkGenerateInput = {
    host: string;
    port: number;
    appDomain?: string;
    serverDomain?: string;
    userId: string;
    secret: string;
    expiresInSeconds?: number;
};

/**
 * Generates a signed app auth URL for a user-scoped context.
 * Expects: host and userId are non-empty strings and secret is valid.
 */
export async function appAuthLinkGenerate(input: AppAuthLinkGenerateInput): Promise<AppAuthLinkResult> {
    const expiresInSeconds = input.expiresInSeconds ?? APP_AUTH_EXPIRES_IN_SECONDS;
    const token = await jwtSign({ userId: input.userId }, input.secret, expiresInSeconds);
    const expiresAt = Date.now() + expiresInSeconds * 1000;

    return {
        userId: input.userId,
        token,
        expiresAt,
        url: appAuthLinkUrlBuild(input.host, input.port, token, input.appDomain, input.serverDomain)
    };
}

/**
 * Builds app auth URL from host/port and token.
 * Expects: host is non-empty, port is valid network port.
 */
export function appAuthLinkUrlBuild(
    host: string,
    port: number,
    token: string,
    appDomain?: string,
    serverDomain?: string
): string {
    const normalizedHost = host.trim();
    if (!normalizedHost) {
        throw new Error("App host is required.");
    }
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error("App port must be an integer between 1 and 65535.");
    }

    const defaults = `http://${normalizedHost}:${port}`;
    const appUrl = appAuthLinkDomainUrlResolve(appDomain ?? serverDomain, defaults, "appDomain");
    const backendUrl = appAuthLinkDomainUrlResolve(serverDomain, appUrl, "serverDomain");
    const hashPayload = appAuthLinkHashPayloadEncode({
        backendUrl,
        token
    });
    return `${appUrl}/auth#${hashPayload}`;
}

function appAuthLinkHashPayloadEncode(payload: { backendUrl: string; token: string }): string {
    return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function appAuthLinkDomainUrlResolve(value: string | undefined, fallback: string, fieldName: string): string {
    const trimmed = value?.trim();
    if (!trimmed) {
        return fallback;
    }

    if (trimmed.includes("://")) {
        const parsed = new URL(trimmed);
        if (parsed.pathname !== "/" || parsed.search || parsed.hash) {
            throw new Error(`${fieldName} must include only protocol, hostname, and optional port.`);
        }
        return `${parsed.protocol}//${parsed.host}`;
    }

    return `https://${trimmed}`;
}

export type AppAuthLinkToolOptions = {
    host: string;
    port: number;
    appDomain?: string;
    serverDomain?: string;
    secretResolve: () => Promise<string>;
};

/**
 * Creates the app_auth_link tool definition.
 * Expects: secretResolve returns the active JWT secret for signing.
 */
export function appAuthLinkTool(options: AppAuthLinkToolOptions): ToolDefinition {
    return {
        tool: {
            name: "app_auth_link",
            description: "Generate a magic link URL that opens the Daycare app for the current user.",
            parameters: appAuthLinkToolSchema
        },
        returns: appAuthLinkReturns,
        execute: async (args, context, toolCall) => {
            const _payload = args as AppAuthLinkArgs;
            const secret = await options.secretResolve();
            const link = await appAuthLinkGenerate({
                host: options.host,
                port: options.port,
                appDomain: options.appDomain,
                serverDomain: options.serverDomain,
                userId: context.ctx.userId,
                secret
            });

            const text = `Open Daycare app: ${link.url}`;
            const toolMessage: ToolResultMessage = {
                role: "toolResult",
                toolCallId: toolCall.id,
                toolName: toolCall.name,
                content: [{ type: "text", text }],
                isError: false,
                timestamp: Date.now()
            };

            return {
                toolMessage,
                typedResult: link
            };
        }
    };
}
