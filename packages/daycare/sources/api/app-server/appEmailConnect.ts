import type { EmailMessage } from "../../email/emailSend.js";
import type { UsersRepository } from "../../storage/usersRepository.js";
import { jwtSign, jwtVerify } from "../../utils/jwt.js";
import { appAuthPayloadUrlBuild } from "./appAuthLinkTool.js";
import { type AppRequestEndpointHeaders, appRequestEndpointsResolve } from "./appRequestEndpointsResolve.js";

export const APP_EMAIL_CONNECT_EXPIRES_IN_SECONDS = 15 * 60;
const APP_EMAIL_CONNECT_SERVICE = "daycare.app-auth.connect-email";

export type AppEmailConnectOptions = {
    users: UsersRepository;
    host: string;
    port: number;
    secret: string;
    serverEndpoint?: string;
    appEndpoint?: string;
    replyTo?: string;
    mailSend: (message: EmailMessage) => Promise<void>;
};

type AppEmailConnectTokenPayload = {
    userId: string;
    email: string;
};

/**
 * Sends and verifies email-connection links for an existing Daycare user.
 * Expects: secret is stable for the app server and mailSend delivers outbound email.
 */
export class AppEmailConnect {
    private readonly users: UsersRepository;
    private readonly host: string;
    private readonly port: number;
    private readonly secret: string;
    private readonly serverEndpoint?: string;
    private readonly appEndpoint?: string;
    private readonly replyTo?: string;
    private readonly mailSend: AppEmailConnectOptions["mailSend"];

    constructor(options: AppEmailConnectOptions) {
        this.users = options.users;
        this.host = options.host;
        this.port = options.port;
        this.secret = options.secret;
        this.serverEndpoint = options.serverEndpoint;
        this.appEndpoint = options.appEndpoint;
        this.replyTo = options.replyTo;
        this.mailSend = options.mailSend;
    }

    async request(userId: string, email: string, headers?: AppRequestEndpointHeaders): Promise<void> {
        const normalizedUserId = userId.trim();
        const normalizedEmail = appEmailNormalize(email);
        if (!normalizedUserId) {
            throw new Error("User is required.");
        }
        if (!normalizedEmail) {
            throw new Error("Email is required.");
        }

        const user = await this.users.findById(normalizedUserId);
        if (!user) {
            throw new Error("User not found.");
        }

        const connector = { name: "email", key: normalizedEmail };
        const existing = await this.users.findByConnector(connector);
        if (existing?.id === normalizedUserId) {
            throw new Error("Email is already connected.");
        }
        if (existing) {
            throw new Error("Email is already connected to another account.");
        }

        const token = await appEmailConnectTokenSign(this.secret, {
            userId: normalizedUserId,
            email: normalizedEmail
        });
        const endpoints = appRequestEndpointsResolve({
            host: this.host,
            port: this.port,
            appEndpoint: this.appEndpoint,
            serverEndpoint: this.serverEndpoint,
            headers
        });
        await this.mailSend(
            appEmailConnectMessageBuild({
                email: normalizedEmail,
                token,
                host: this.host,
                port: this.port,
                serverEndpoint: endpoints.serverEndpoint,
                appEndpoint: endpoints.appEndpoint,
                replyTo: this.replyTo
            })
        );
    }

    async verify(token: string): Promise<{ userId: string; email: string }> {
        const normalizedToken = token.trim();
        if (!normalizedToken) {
            throw new Error("Magic-link token is required.");
        }

        const payload = await appEmailConnectTokenVerify(normalizedToken, this.secret);
        const user = await this.users.findById(payload.userId);
        if (!user) {
            throw new Error("User not found.");
        }

        const connector = { name: "email", key: payload.email };
        const existing = await this.users.findByConnector(connector);
        if (existing?.id === payload.userId) {
            return payload;
        }
        if (existing) {
            throw new Error("Email is already connected to another account.");
        }

        await this.users.addConnector(payload.userId, connector);
        return payload;
    }
}

function appEmailNormalize(email: string): string {
    return email.trim().toLowerCase();
}

async function appEmailConnectTokenSign(secret: string, payload: AppEmailConnectTokenPayload): Promise<string> {
    return jwtSign(
        {
            userId: Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")
        },
        secret,
        APP_EMAIL_CONNECT_EXPIRES_IN_SECONDS,
        {
            service: APP_EMAIL_CONNECT_SERVICE
        }
    );
}

async function appEmailConnectTokenVerify(token: string, secret: string): Promise<AppEmailConnectTokenPayload> {
    const verified = await jwtVerify(token, secret, {
        service: APP_EMAIL_CONNECT_SERVICE
    });

    try {
        const parsed = JSON.parse(Buffer.from(verified.userId, "base64url").toString("utf8")) as {
            userId?: unknown;
            email?: unknown;
        };
        const userId = typeof parsed.userId === "string" ? parsed.userId.trim() : "";
        const email = typeof parsed.email === "string" ? appEmailNormalize(parsed.email) : "";
        if (!userId || !email) {
            throw new Error("Invalid email connect token payload.");
        }
        return {
            userId,
            email
        };
    } catch {
        throw new Error("Invalid email connect token payload.");
    }
}

function appEmailConnectMessageBuild(options: {
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
            kind: "connect-email"
        },
        options.appEndpoint,
        options.serverEndpoint
    );

    return {
        to: options.email,
        subject: "Connect your email to Daycare",
        replyTo: options.replyTo,
        text: `Use this link to connect your email to Daycare: ${url}`,
        html: [
            "<p>Use this link to connect your email to Daycare.</p>",
            `<p><a href="${url}">Connect email</a></p>`,
            `<p>${url}</p>`
        ].join("")
    };
}
