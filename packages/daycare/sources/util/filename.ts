const INVALID_CHARS = /[^a-zA-Z0-9._-]+/g;

export function sanitizeFilename(input: string): string {
    const trimmed = input.trim();
    const safe = trimmed.replace(INVALID_CHARS, "_");
    return safe.length > 0 ? safe : "file";
}
