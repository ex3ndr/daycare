const HOST_PATTERN = /[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+/i;

export type CloudflareDomainResolution = {
    hostname: string;
    domain: string;
};

/**
 * Resolves hostname/domain from cloudflared tunnel info output.
 * Expects: output includes at least one hostname value.
 */
export function cloudflareDomainResolve(output: string): CloudflareDomainResolution {
    let parsed: unknown;
    try {
        parsed = JSON.parse(output) as unknown;
    } catch {
        parsed = null;
    }

    let hostname = parsed ? hostnameFind(parsed) : null;
    if (!hostname) {
        const match = output.match(HOST_PATTERN);
        hostname = match?.[0] ?? null;
    }
    if (!hostname) {
        throw new Error("Could not resolve cloudflare tunnel hostname.");
    }

    const normalized = hostname.trim().replace(/\.$/, "").toLowerCase();
    const labels = normalized.split(".").filter((item) => item.length > 0);
    if (labels.length < 3) {
        throw new Error(`Invalid cloudflare hostname: ${normalized}`);
    }

    return {
        hostname: normalized,
        domain: labels.slice(1).join(".")
    };
}

function hostnameFind(value: unknown): string | null {
    if (typeof value === "string") {
        return HOST_PATTERN.test(value) ? value : null;
    }
    if (!value || typeof value !== "object") {
        return null;
    }
    if (Array.isArray(value)) {
        for (const item of value) {
            const found = hostnameFind(item);
            if (found) {
                return found;
            }
        }
        return null;
    }

    for (const entry of Object.values(value as Record<string, unknown>)) {
        const found = hostnameFind(entry);
        if (found) {
            return found;
        }
    }
    return null;
}
