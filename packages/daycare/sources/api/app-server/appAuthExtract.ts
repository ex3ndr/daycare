import type http from "node:http";
import { jwtVerify } from "../../utils/jwt.js";

/**
 * Extracts and verifies a JWT from the Authorization: Bearer header.
 * Returns the decoded userId on success, null on failure.
 *
 * Expects: secretResolve returns the active JWT secret.
 */
export async function appAuthExtract(
    request: http.IncomingMessage,
    secretResolve: () => Promise<string>
): Promise<{ userId: string } | null> {
    const header = request.headers.authorization;
    if (!header) {
        return null;
    }

    const parts = header.split(" ");
    if (parts.length !== 2 || parts[0]?.toLowerCase() !== "bearer") {
        return null;
    }

    const token = parts[1]?.trim();
    if (!token) {
        return null;
    }

    try {
        const payload = await jwtVerify(token, await secretResolve());
        return { userId: payload.userId };
    } catch {
        return null;
    }
}
