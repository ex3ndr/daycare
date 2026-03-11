import { jwtSign, jwtVerify } from "../../utils/jwt.js";

export const MINI_APP_TOKEN_SERVICE = "daycare.mini-app";

export type MiniAppTokenPayload = {
    userId: string;
    appId: string;
    version: number;
    iat: number;
    exp: number;
};

/**
 * Signs a short-lived mini-app launch token pinned to one user/app/version tuple.
 * Expects: userId and appId are non-empty and version is a positive integer.
 */
export async function miniAppTokenSign(
    payload: { userId: string; appId: string; version: number },
    secret: string,
    expiresInSeconds: number
): Promise<string> {
    if (!Number.isInteger(payload.version) || payload.version <= 0) {
        throw new Error("Mini app version must be a positive integer.");
    }
    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
    return jwtSign({ userId: encoded }, secret, expiresInSeconds, {
        service: MINI_APP_TOKEN_SERVICE
    });
}

/**
 * Verifies one mini-app launch token and restores its scoped payload.
 * Expects: token was issued by miniAppTokenSign with the same secret.
 */
export async function miniAppTokenVerify(token: string, secret: string): Promise<MiniAppTokenPayload> {
    const verified = await jwtVerify(token, secret, {
        service: MINI_APP_TOKEN_SERVICE
    });
    try {
        const parsed = JSON.parse(Buffer.from(verified.userId, "base64url").toString("utf8")) as {
            userId?: unknown;
            appId?: unknown;
            version?: unknown;
        };
        const version = parsed.version;
        if (
            typeof parsed.userId !== "string" ||
            typeof parsed.appId !== "string" ||
            typeof version !== "number" ||
            !Number.isInteger(version) ||
            version <= 0
        ) {
            throw new Error("Invalid mini-app token payload.");
        }
        return {
            userId: parsed.userId,
            appId: parsed.appId,
            version,
            iat: verified.iat,
            exp: verified.exp
        };
    } catch {
        throw new Error("Invalid mini-app token payload.");
    }
}
