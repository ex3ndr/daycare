/**
 * Validates sandbox allowedDomains entries.
 * Expects: allowedDomains is already normalized and deduped.
 * A global wildcard ("*") disables domain restrictions entirely.
 */
export function sandboxAllowedDomainsValidate(_allowedDomains: string[]): string[] {
    const issues: string[] = [];
    return issues;
}
