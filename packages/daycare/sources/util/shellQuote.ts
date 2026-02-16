/**
 * Quotes a string for safe single-quoted shell command interpolation.
 * Expects: raw unquoted string input; output is wrapped in single quotes.
 */
export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\"'\"'`)}'`;
}
