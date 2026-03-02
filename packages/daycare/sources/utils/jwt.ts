import { createEphemeralTokenGenerator, createEphemeralTokenVerifier } from "privacy-kit";

export type JwtUserPayload = {
    userId: string;
    iat: number;
    exp: number;
};

export const JWT_SERVICE_APP_AUTH = "daycare.app-auth";
export const JWT_SERVICE_WEBHOOK = "daycare.webhook";

type JwtTokenOptions = {
    service?: string;
};

/**
 * Signs a short-lived user token using privacy-kit ephemeral tokens.
 * Expects: payload.userId is non-empty and expiresInSeconds is an integer.
 */
export async function jwtSign(
    payload: { userId: string },
    secret: string,
    expiresInSeconds: number,
    options: JwtTokenOptions = {}
): Promise<string> {
    const userId = payload.userId.trim();
    if (!userId) {
        throw new Error("JWT payload userId is required.");
    }
    if (!Number.isInteger(expiresInSeconds)) {
        throw new Error("JWT expiresInSeconds must be an integer.");
    }
    const service = jwtServiceNormalize(options.service);

    const generator = await createEphemeralTokenGenerator({
        service,
        seed: jwtSecretNormalize(secret),
        ttl: expiresInSeconds * 1000
    });
    return generator.new({ user: userId });
}

/**
 * Verifies a user token and normalizes its core claims.
 * Expects: token is signed by jwtSign with the provided secret.
 */
export async function jwtVerify(token: string, secret: string, options: JwtTokenOptions = {}): Promise<JwtUserPayload> {
    const normalizedSecret = jwtSecretNormalize(secret);
    const service = jwtServiceNormalize(options.service);

    const generator = await createEphemeralTokenGenerator({
        service,
        seed: normalizedSecret,
        ttl: 60_000
    });
    const verifier = await createEphemeralTokenVerifier({
        service,
        publicKey: generator.publicKey
    });

    const verified = await verifier.verify(token);
    const claims = jwtClaimsDecode(token);
    if (!verified || typeof verified.user !== "string" || !claims) {
        throw new Error("Invalid JWT payload.");
    }

    return {
        userId: verified.user,
        iat: claims.iat,
        exp: claims.exp
    };
}

function jwtSecretNormalize(secret: string): string {
    const normalized = secret.trim();
    if (!normalized) {
        throw new Error("JWT secret is required.");
    }
    return normalized;
}

function jwtServiceNormalize(service: string | undefined): string {
    const normalized = service?.trim() ?? JWT_SERVICE_APP_AUTH;
    if (!normalized) {
        throw new Error("JWT service is required.");
    }
    return normalized;
}

function jwtClaimsDecode(token: string): { iat: number; exp: number } | null {
    const parts = token.split(".");
    const payloadPart = parts[1];
    if (parts.length !== 3 || typeof payloadPart !== "string") {
        return null;
    }

    try {
        const payload = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8")) as Record<string, unknown>;
        if (typeof payload.iat !== "number" || typeof payload.exp !== "number") {
            return null;
        }
        return {
            iat: payload.iat,
            exp: payload.exp
        };
    } catch {
        return null;
    }
}
