/**
 * Builds the full API URL with optional workspace prefix.
 * When workspaceId is set, prepends /w/{id} to the path.
 */
export function apiUrl(baseUrl: string, path: string, workspaceId: string | null): string {
    const prefix = workspaceId ? `/w/${encodeURIComponent(workspaceId)}` : "";
    return `${baseUrl}${prefix}${path}`;
}
