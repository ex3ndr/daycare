/**
 * Validates sandbox allowedDomains against wildcard and explicit-domain requirements.
 * Expects: allowedDomains is already normalized and deduped.
 */
export function sandboxAllowedDomainsValidate(allowedDomains: string[]): string[] {
    const issues: string[] = [];
    if (allowedDomains.includes("*")) {
        issues.push('Wildcard "*" is not allowed in allowedDomains.');
    }
    if (allowedDomains.length === 0) {
        issues.push("allowedDomains must include at least one explicit domain.");
    }
    return issues;
}
