/**
 * Validates whether a secret name uses kebab-case segments.
 * Expects: name is already trimmed.
 */
export function secretValidateName(name: string): boolean {
    return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name);
}
