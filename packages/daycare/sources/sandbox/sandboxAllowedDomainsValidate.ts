/**
 * Validates sandbox allowedDomains against global wildcard and network permission state.
 * Expects: allowedDomains is already normalized and deduped.
 */
export function sandboxAllowedDomainsValidate(allowedDomains: string[], networkAllowed: boolean): string[] {
    const issues: string[] = [];
    if (allowedDomains.includes("*")) {
        issues.push('Wildcard "*" is not allowed in allowedDomains.');
    }
    if (allowedDomains.length > 0 && !networkAllowed) {
        issues.push("Network permission is required to set allowedDomains.");
    }
    if (networkAllowed && allowedDomains.length === 0) {
        issues.push("Network cannot be enabled without allowedDomains.");
    }
    return issues;
}
