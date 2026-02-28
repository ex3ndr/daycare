import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";
import type { ToolDefinition, ToolResultContract } from "@/types";
import { jwtSign } from "../../util/jwt.js";
import { appEndpointNormalize } from "./appEndpointNormalize.js";

export const APP_AUTH_LINK_EXPIRES_IN_SECONDS = 3600;
export const APP_AUTH_SESSION_EXPIRES_IN_SECONDS = 365 * 24 * 60 * 60;
export const APP_AUTH_LINK_SERVICE = "daycare.app-auth.link";
export const APP_AUTH_DEFAULT_ENDPOINT = "https://daycare.dev";

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
    appEndpoint?: string;
    serverEndpoint?: string;
    userId: string;
    secret: string;
    expiresInSeconds?: number;
};

/**
 * Generates a signed app auth URL for a user-scoped context.
 * Expects: host and userId are non-empty strings and secret is valid.
 */
export async function appAuthLinkGenerate(input: AppAuthLinkGenerateInput): Promise<AppAuthLinkResult> {
    const expiresInSeconds = input.expiresInSeconds ?? APP_AUTH_LINK_EXPIRES_IN_SECONDS;
    const token = await jwtSign({ userId: input.userId }, input.secret, expiresInSeconds, {
        service: APP_AUTH_LINK_SERVICE
    });
    const expiresAt = Date.now() + expiresInSeconds * 1000;

    return {
        userId: input.userId,
        token,
        expiresAt,
        url: appAuthLinkUrlBuild(input.host, input.port, token, input.appEndpoint, input.serverEndpoint)
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
    appEndpoint?: string,
    serverEndpoint?: string
): string {
    const normalizedHost = host.trim();
    if (!normalizedHost) {
        throw new Error("App host is required.");
    }
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error("App port must be an integer between 1 and 65535.");
    }

    const defaults = APP_AUTH_DEFAULT_ENDPOINT;
    const resolvedAppEndpoint = appEndpointNormalize(appEndpoint, "appEndpoint");
    const resolvedServerEndpoint = appEndpointNormalize(serverEndpoint, "serverEndpoint");
    const appUrl = resolvedAppEndpoint ?? resolvedServerEndpoint ?? defaults;
    const backendUrl = resolvedServerEndpoint ?? appUrl;
    const hashPayload = appAuthLinkHashPayloadEncode({
        backendUrl,
        token
    });
    return `${appUrl}/auth#${hashPayload}`;
}

function appAuthLinkHashPayloadEncode(payload: { backendUrl: string; token: string }): string {
    return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export type AppAuthLinkToolOptions = {
    host: string;
    port: number;
    appEndpoint?: string;
    serverEndpoint?: string;
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
                appEndpoint: options.appEndpoint,
                serverEndpoint: options.serverEndpoint,
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
