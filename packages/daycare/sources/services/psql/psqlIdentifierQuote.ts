const PSQL_IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Quotes a SQL identifier after strict validation.
 * Expects: identifier is an unqualified table/column/index name.
 */
export function psqlIdentifierQuote(identifier: string): string {
    const normalized = identifier.trim();
    if (!PSQL_IDENTIFIER_PATTERN.test(normalized)) {
        throw new Error(`Invalid SQL identifier: ${identifier}`);
    }
    return `"${normalized}"`;
}
