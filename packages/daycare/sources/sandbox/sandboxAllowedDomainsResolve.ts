import { SANDBOX_PACKAGE_MANAGER_DOMAINS, type SandboxPackageManager } from "./sandboxPackageManagers.js";

/**
 * Resolves explicit allowed domains and package-manager presets into one deduped list.
 * Expects: allowedDomains entries are hostnames and packageManagers are validated names.
 */
export function sandboxAllowedDomainsResolve(
    allowedDomains?: string[],
    packageManagers?: SandboxPackageManager[]
): string[] {
    const next: string[] = [];
    const seen = new Set<string>();

    for (const entry of allowedDomains ?? []) {
        const trimmed = entry.trim();
        if (!trimmed) {
            throw new Error("allowedDomains entries cannot be blank.");
        }
        appendUnique(next, seen, trimmed);
    }

    for (const manager of packageManagers ?? []) {
        const domains = SANDBOX_PACKAGE_MANAGER_DOMAINS[manager];
        for (const domain of domains) {
            appendUnique(next, seen, domain);
        }
    }

    return next;
}

function appendUnique(next: string[], seen: Set<string>, value: string): void {
    if (seen.has(value)) {
        return;
    }
    seen.add(value);
    next.push(value);
}
