/**
 * Builds the full API URL with optional workspace prefix.
 * When workspaceNametag is set, prepends /w/{nametag} to the path.
 */
export function apiUrl(baseUrl: string, path: string, workspaceNametag: string | null): string {
    const prefix = workspaceNametag ? `/w/${encodeURIComponent(workspaceNametag)}` : "";
    return `${baseUrl}${prefix}${path}`;
}
