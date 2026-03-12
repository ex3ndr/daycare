import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";
import type { EmailMessage } from "../../email/emailSend.js";
import type { DaycareDb } from "../../schema.js";
import {
    appAuthAccountsTable,
    appAuthSessionsTable,
    appAuthUsersTable,
    appAuthVerificationsTable
} from "../../schema.js";
import type { UsersRepository } from "../../storage/usersRepository.js";
import { APP_AUTH_SESSION_EXPIRES_IN_SECONDS, appAuthPayloadUrlBuild } from "./appAuthLinkTool.js";
import { type AppRequestEndpointHeaders, appRequestEndpointsResolve } from "./appRequestEndpointsResolve.js";

export type AppEmailAuthOptions = {
    db: DaycareDb;
    users: UsersRepository;
    host: string;
    port: number;
    serverEndpoint?: string;
    appEndpoint?: string;
    secret: string;
    replyTo?: string;
    mailSend: (message: EmailMessage) => Promise<void>;
};

/**
 * Coordinates Better Auth magic-link email delivery and maps verified emails to Daycare users.
 * Expects: storage migrations are applied and mailSend delivers outbound email.
 */
export class AppEmailAuth {
    private readonly users: UsersRepository;
    private readonly host: string;
    private readonly port: number;
    private readonly serverEndpoint?: string;
    private readonly appEndpoint?: string;
    private readonly secret: string;
    private readonly replyTo?: string;
    private readonly mailSend: AppEmailAuthOptions["mailSend"];
    private readonly db: DaycareDb;

    constructor(options: AppEmailAuthOptions) {
        this.db = options.db;
        this.users = options.users;
        this.host = options.host;
        this.port = options.port;
        this.serverEndpoint = options.serverEndpoint;
        this.appEndpoint = options.appEndpoint;
        this.secret = options.secret;
        this.replyTo = options.replyTo;
        this.mailSend = options.mailSend;
    }

    async request(email: string, headers?: AppRequestEndpointHeaders): Promise<void> {
        const normalizedEmail = appEmailNormalize(email);
        if (!normalizedEmail) {
            throw new Error("Email is required.");
        }

        const endpoints = appRequestEndpointsResolve({
            host: this.host,
            port: this.port,
            appEndpoint: this.appEndpoint,
            serverEndpoint: this.serverEndpoint,
            headers
        });
        const auth = this.authCreate(endpoints);

        await auth.api.signInMagicLink({
            body: {
                email: normalizedEmail
            },
            headers: appEmailAuthHeadersBuild(headers, this.host, this.port, endpoints.serverEndpoint)
        });
    }

    async verify(token: string, headers?: AppRequestEndpointHeaders): Promise<{ email: string; userId: string }> {
        const normalizedToken = token.trim();
        if (!normalizedToken) {
            throw new Error("Magic-link token is required.");
        }

        const endpoints = appRequestEndpointsResolve({
            host: this.host,
            port: this.port,
            appEndpoint: this.appEndpoint,
            serverEndpoint: this.serverEndpoint,
            headers
        });
        const auth = this.authCreate(endpoints);

        const result = await auth.api.magicLinkVerify({
            query: {
                token: normalizedToken
            },
            headers: appEmailAuthHeadersBuild(headers, this.host, this.port, endpoints.serverEndpoint)
        });

        const email = appEmailNormalize(result.user.email);
        if (!email) {
            throw new Error("Verified email is missing.");
        }

        const userId = await this.userIdResolveByEmail(email);
        return {
            email,
            userId
        };
    }

    private authCreate(endpoints: { appEndpoint: string; serverEndpoint: string }) {
        return appEmailAuthCreate(
            {
                db: this.db,
                users: this.users,
                host: this.host,
                port: this.port,
                serverEndpoint: endpoints.serverEndpoint,
                appEndpoint: endpoints.appEndpoint,
                secret: this.secret,
                replyTo: this.replyTo,
                mailSend: this.mailSend
            },
            async ({ email, token }) => {
                await this.mailSend(
                    appEmailAuthMessageBuild({
                        email,
                        token,
                        host: this.host,
                        port: this.port,
                        serverEndpoint: endpoints.serverEndpoint,
                        appEndpoint: endpoints.appEndpoint,
                        replyTo: this.replyTo
                    })
                );
            }
        );
    }

    private async userIdResolveByEmail(email: string): Promise<string> {
        const connector = { name: "email", key: email };
        const existing = await this.users.findByConnector(connector);
        if (existing) {
            return existing.id;
        }

        try {
            const created = await this.users.create({
                connector
            });
            return created.id;
        } catch (error) {
            const raced = await this.users.findByConnector(connector);
            if (raced) {
                return raced.id;
            }
            throw error;
        }
    }
}

function appEmailNormalize(email: string): string {
    return email.trim().toLowerCase();
}

function appEmailAuthCreate(
    options: AppEmailAuthOptions,
    sendMagicLink: (data: { email: string; token: string }) => Promise<void>
) {
    return betterAuth({
        secret: options.secret,
        baseURL: appEmailAuthBaseUrlResolve(options.host, options.port, options.serverEndpoint),
        session: {
            expiresIn: APP_AUTH_SESSION_EXPIRES_IN_SECONDS
        },
        database: drizzleAdapter(options.db, {
            provider: "pg",
            schema: {
                user: appAuthUsersTable,
                session: appAuthSessionsTable,
                account: appAuthAccountsTable,
                verification: appAuthVerificationsTable
            },
            usePlural: false
        }),
        plugins: [
            magicLink({
                sendMagicLink: async ({ email, token }) => {
                    await sendMagicLink({ email, token });
                }
            })
        ]
    });
}

function appEmailAuthBaseUrlResolve(host: string, port: number, serverEndpoint?: string): string {
    return serverEndpoint?.trim() || `http://${host}:${port}`;
}

function appEmailAuthHeadersBuild(
    headers: AppRequestEndpointHeaders | undefined,
    host: string,
    port: number,
    serverEndpoint?: string
): Headers {
    const result = new Headers();
    const source =
        headers instanceof Headers
            ? headers
            : Array.isArray(headers)
              ? new Headers(headers)
              : new Headers(appEmailAuthHeadersNormalize(headers));
    source.forEach((value, key) => {
        result.set(key, value);
    });

    const baseUrl = new URL(appEmailAuthBaseUrlResolve(host, port, serverEndpoint));
    if (!result.has("host")) {
        result.set("host", baseUrl.host);
    }
    if (!result.has("origin")) {
        result.set("origin", baseUrl.origin);
    }
    if (!result.has("x-forwarded-host")) {
        result.set("x-forwarded-host", baseUrl.host);
    }
    if (!result.has("x-forwarded-proto")) {
        result.set("x-forwarded-proto", baseUrl.protocol.replace(":", ""));
    }
    return result;
}

function appEmailAuthHeadersNormalize(headers: AppRequestEndpointHeaders | undefined): Record<string, string> {
    if (!headers || headers instanceof Headers || Array.isArray(headers)) {
        return {};
    }

    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
        if (typeof value === "string") {
            result[key] = value;
            continue;
        }
        if (Array.isArray(value)) {
            result[key] = value.join(", ");
        }
    }
    return result;
}

function appEmailAuthMessageBuild(options: {
    email: string;
    token: string;
    host: string;
    port: number;
    serverEndpoint?: string;
    appEndpoint?: string;
    replyTo?: string;
}): EmailMessage {
    const url = appAuthPayloadUrlBuild(
        options.host,
        options.port,
        {
            backendUrl: options.serverEndpoint?.trim() ?? "",
            token: options.token,
            kind: "email"
        },
        options.appEndpoint,
        options.serverEndpoint
    );

    return {
        to: options.email,
        subject: "Your Daycare sign-in link",
        replyTo: options.replyTo,
        text: `Use this link to sign in to Daycare: ${url}`,
        html: [
            "<p>Use this link to sign in to Daycare.</p>",
            `<p><a href="${url}">Open Daycare</a></p>`,
            `<p>${url}</p>`
        ].join("")
    };
}
