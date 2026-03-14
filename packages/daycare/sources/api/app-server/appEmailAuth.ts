import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import type { EmailMessage } from "../../email/emailSend.js";
import type { UsersRepository } from "../../storage/usersRepository.js";
import { AsyncLock } from "../../utils/lock.js";

export const APP_EMAIL_CODE_EXPIRES_IN_MS = 10 * 60 * 1000;
export const APP_EMAIL_CODE_RESEND_IN_MS = 30 * 1000;
export const APP_EMAIL_CODE_REQUEST_WINDOW_MS = 10 * 60 * 1000;
export const APP_EMAIL_CODE_MAX_REQUESTS_PER_WINDOW = 5;
export const APP_EMAIL_CODE_MAX_ATTEMPTS = 5;

type AppEmailChallenge = {
    codeHash: Buffer;
    salt: string;
    expiresAt: number;
    resendAvailableAt: number;
    requestWindowStartedAt: number;
    requestCount: number;
    failedAttempts: number;
    updatedAt: number;
};

export type AppEmailAuthOptions = {
    users: UsersRepository;
    secret: string;
    replyTo?: string;
    mailSend: (message: EmailMessage) => Promise<void>;
};

export type AppEmailRequestResult = {
    expiresAt: number;
    retryAfterMs: number;
};

/**
 * Coordinates email sign-in codes and maps verified emails to Daycare users.
 * Expects: secret is stable for the app server process and mailSend delivers outbound email.
 */
export class AppEmailAuth {
    private readonly users: UsersRepository;
    private readonly secret: string;
    private readonly replyTo?: string;
    private readonly mailSend: AppEmailAuthOptions["mailSend"];
    private readonly pendingEmails = new Map<string, AppEmailChallenge>();
    private readonly pendingLock = new AsyncLock();

    constructor(options: AppEmailAuthOptions) {
        this.users = options.users;
        this.secret = options.secret.trim();
        this.replyTo = options.replyTo;
        this.mailSend = options.mailSend;
    }

    async request(email: string): Promise<AppEmailRequestResult> {
        const normalizedEmail = appEmailNormalize(email);
        if (!appEmailIsValid(normalizedEmail)) {
            throw new Error("A valid email is required.");
        }

        return this.pendingLock.inLock(async () => {
            const now = Date.now();
            this.pendingPrune(now);

            const existing = this.pendingEmails.get(normalizedEmail);
            if (existing && now < existing.resendAvailableAt) {
                throw new Error(appEmailRetryMessage(existing.resendAvailableAt - now));
            }

            const requestWindowStartedAt =
                existing && now - existing.requestWindowStartedAt < APP_EMAIL_CODE_REQUEST_WINDOW_MS
                    ? existing.requestWindowStartedAt
                    : now;
            const requestCount =
                existing && requestWindowStartedAt === existing.requestWindowStartedAt ? existing.requestCount + 1 : 1;
            if (requestCount > APP_EMAIL_CODE_MAX_REQUESTS_PER_WINDOW) {
                throw new Error(
                    `Too many sign-in codes requested. Try again in ${appEmailMinutesText(
                        requestWindowStartedAt + APP_EMAIL_CODE_REQUEST_WINDOW_MS - now
                    )}.`
                );
            }

            const code = appEmailCodeGenerate();
            const salt = randomBytes(16).toString("hex");
            const expiresAt = now + APP_EMAIL_CODE_EXPIRES_IN_MS;
            const resendAvailableAt = now + APP_EMAIL_CODE_RESEND_IN_MS;

            await this.mailSend(
                appEmailAuthMessageBuild({
                    email: normalizedEmail,
                    code,
                    expiresAt,
                    replyTo: this.replyTo
                })
            );

            this.pendingEmails.set(normalizedEmail, {
                codeHash: appEmailCodeHash(this.secret, normalizedEmail, salt, code),
                salt,
                expiresAt,
                resendAvailableAt,
                requestWindowStartedAt,
                requestCount,
                failedAttempts: 0,
                updatedAt: now
            });

            return {
                expiresAt,
                retryAfterMs: APP_EMAIL_CODE_RESEND_IN_MS
            };
        });
    }

    async verify(email: string, code: string): Promise<{ email: string; userId: string }> {
        const normalizedEmail = appEmailNormalize(email);
        const normalizedCode = appEmailCodeNormalize(code);
        if (!appEmailIsValid(normalizedEmail)) {
            throw new Error("A valid email is required.");
        }
        if (!normalizedCode) {
            throw new Error("Code must be six digits.");
        }

        return this.pendingLock.inLock(async () => {
            const now = Date.now();
            this.pendingPrune(now);

            const pending = this.pendingEmails.get(normalizedEmail);
            if (!pending) {
                throw new Error("Invalid or expired sign-in code.");
            }
            if (now > pending.expiresAt) {
                this.pendingEmails.delete(normalizedEmail);
                throw new Error("Invalid or expired sign-in code.");
            }
            if (pending.failedAttempts >= APP_EMAIL_CODE_MAX_ATTEMPTS) {
                this.pendingEmails.delete(normalizedEmail);
                throw new Error("Too many failed attempts. Request a new sign-in code.");
            }

            const providedHash = appEmailCodeHash(this.secret, normalizedEmail, pending.salt, normalizedCode);
            if (!timingSafeEqual(providedHash, pending.codeHash)) {
                const failedAttempts = pending.failedAttempts + 1;
                if (failedAttempts >= APP_EMAIL_CODE_MAX_ATTEMPTS) {
                    this.pendingEmails.delete(normalizedEmail);
                    throw new Error("Too many failed attempts. Request a new sign-in code.");
                }
                this.pendingEmails.set(normalizedEmail, {
                    ...pending,
                    failedAttempts,
                    updatedAt: now
                });
                throw new Error("Invalid or expired sign-in code.");
            }

            this.pendingEmails.delete(normalizedEmail);
            const userId = await this.userIdResolveByEmail(normalizedEmail);
            return {
                email: normalizedEmail,
                userId
            };
        });
    }

    private pendingPrune(now: number): void {
        for (const [email, challenge] of this.pendingEmails.entries()) {
            if (
                challenge.expiresAt <= now ||
                challenge.requestWindowStartedAt + APP_EMAIL_CODE_REQUEST_WINDOW_MS <= now ||
                challenge.updatedAt + APP_EMAIL_CODE_REQUEST_WINDOW_MS <= now
            ) {
                this.pendingEmails.delete(email);
            }
        }
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

function appEmailIsValid(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function appEmailCodeGenerate(): string {
    return `${randomInt(1, 10)}${randomInt(0, 10)}${randomInt(0, 10)}${randomInt(0, 10)}${randomInt(0, 10)}${randomInt(0, 10)}`;
}

function appEmailCodeNormalize(code: string): string | null {
    const digits = code.replaceAll(/\D/g, "");
    return /^[1-9][0-9]{5}$/.test(digits) ? digits : null;
}

function appEmailCodeHash(secret: string, email: string, salt: string, code: string): Buffer {
    return createHmac("sha256", secret).update(`${email}:${salt}:${code}`, "utf8").digest();
}

function appEmailRetryMessage(retryAfterMs: number): string {
    return `Please wait ${appEmailSecondsText(retryAfterMs)} before requesting another sign-in code.`;
}

function appEmailSecondsText(durationMs: number): string {
    const seconds = Math.max(1, Math.ceil(durationMs / 1000));
    return `${seconds} second${seconds === 1 ? "" : "s"}`;
}

function appEmailMinutesText(durationMs: number): string {
    const minutes = Math.max(1, Math.ceil(durationMs / 60_000));
    return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

function appEmailAuthMessageBuild(options: {
    email: string;
    code: string;
    expiresAt: number;
    replyTo?: string;
}): EmailMessage {
    const expiresInMinutes = Math.max(1, Math.ceil((options.expiresAt - Date.now()) / 60_000));
    const expirationText = `${expiresInMinutes} minute${expiresInMinutes === 1 ? "" : "s"}`;

    return {
        to: options.email,
        subject: "Your Daycare sign-in code",
        replyTo: options.replyTo,
        text: `Your Daycare sign-in code is ${options.code}. It expires in ${expirationText}.`,
        html: [
            "<p>Your Daycare sign-in code is:</p>",
            `<p><strong style="font-size: 28px; letter-spacing: 4px;">${options.code}</strong></p>`,
            `<p>It expires in ${expirationText}.</p>`
        ].join("")
    };
}
