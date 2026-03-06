/**
 * Encodes a file path for use in URL segments.
 * Replaces `/` with `~` since URL segments can't contain slashes.
 */
export function filesPathEncode(path: string): string {
    return path.replace(/\//g, "~");
}

/**
 * Decodes a URL segment back into a file path.
 * Replaces `~` with `/`.
 */
export function filesPathDecode(encoded: string): string {
    return encoded.replace(/~/g, "/");
}
