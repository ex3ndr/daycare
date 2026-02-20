/**
 * Returns true when a string is a valid Python identifier.
 * Expects: value is an unqualified function or argument name.
 */
export function montyPythonIdentifierIs(value: string): boolean {
    return /^[A-Za-z_][A-Za-z0-9_]*$/.test(value);
}
