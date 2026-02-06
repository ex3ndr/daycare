/**
 * Converts a string to a URL-safe slug.
 *
 * Expects: any string input.
 * Returns: lowercase string with non-alphanumeric characters replaced by hyphens,
 *          with leading/trailing hyphens removed.
 */
export function stringSlugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
