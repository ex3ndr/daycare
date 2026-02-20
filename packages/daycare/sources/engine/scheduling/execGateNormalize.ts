import type { ExecGateDefinition } from "@/types";
import { SANDBOX_PACKAGE_MANAGERS } from "../../sandbox/sandboxPackageManagers.js";
import { envNormalize } from "../../util/envNormalize.js";

/**
 * Normalizes an exec gate definition from untyped input.
 * Returns undefined when the value is missing or lacks a command.
 */
export function execGateNormalize(value: unknown): ExecGateDefinition | undefined {
    if (!value || typeof value !== "object") {
        return undefined;
    }
    const candidate = value as {
        command?: unknown;
        cwd?: unknown;
        timeoutMs?: unknown;
        env?: unknown;
        home?: unknown;
        permissions?: unknown;
        packageManagers?: unknown;
        allowedDomains?: unknown;
    };
    if (typeof candidate.command !== "string") {
        return undefined;
    }
    const command = candidate.command.trim();
    if (!command) {
        return undefined;
    }

    const next: ExecGateDefinition = { command };

    if (typeof candidate.cwd === "string") {
        const cwd = candidate.cwd.trim();
        if (cwd) {
            next.cwd = cwd;
        }
    }

    if (typeof candidate.timeoutMs === "number" && Number.isFinite(candidate.timeoutMs)) {
        next.timeoutMs = candidate.timeoutMs;
    }

    const env = envNormalize(candidate.env);
    if (env) {
        next.env = env;
    }
    if (typeof candidate.home === "string") {
        const home = candidate.home.trim();
        if (home.length > 0) {
            next.home = home;
        }
    }

    const permissions = normalizeStringArray(candidate.permissions);
    if (permissions.length > 0) {
        next.permissions = permissions;
    }

    const packageManagers = normalizePackageManagers(candidate.packageManagers);
    if (packageManagers.length > 0) {
        next.packageManagers = packageManagers;
    }

    const allowedDomains = normalizeStringArray(candidate.allowedDomains);
    if (allowedDomains.length > 0) {
        next.allowedDomains = allowedDomains;
    }

    return next;
}

function normalizeStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return [];
    }
    const entries = value
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
    return Array.from(new Set(entries));
}

function normalizePackageManagers(value: unknown): (typeof SANDBOX_PACKAGE_MANAGERS)[number][] {
    if (!Array.isArray(value)) {
        return [];
    }
    const allowed = new Set<string>(SANDBOX_PACKAGE_MANAGERS);
    const entries = value
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter((entry): entry is (typeof SANDBOX_PACKAGE_MANAGERS)[number] => allowed.has(entry));
    return Array.from(new Set(entries));
}
