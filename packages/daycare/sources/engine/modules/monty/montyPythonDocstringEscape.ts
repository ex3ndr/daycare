/**
 * Escapes triple quotes for safe embedding in Python docstrings.
 * Expects: value is plain text description content.
 */
export function montyPythonDocstringEscape(value: string): string {
  return value.replace(/\"\"\"/g, '\\"\\"\\"');
}
