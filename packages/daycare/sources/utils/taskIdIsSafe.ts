/**
 * Validates that a task ID contains only safe characters.
 *
 * Expects: any string value.
 * Returns: true if value matches [a-zA-Z0-9._-]+, false otherwise.
 */
export function taskIdIsSafe(value: string): boolean {
  return /^[a-zA-Z0-9._-]+$/.test(value);
}
