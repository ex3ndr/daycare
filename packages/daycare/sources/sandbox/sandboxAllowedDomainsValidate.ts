/**
 * Validates sandbox allowedDomains against wildcard requirements.
 * Expects: allowedDomains is already normalized and deduped.
 */
export function sandboxAllowedDomainsValidate(allowedDomains: string[]): string[] {
    const issues: string[] = [];
    if (allowedDomains.includes("*")) {
        issues.push('Wildcard "*" is not allowed in allowedDomains.');
    }
    return issues;
}
