/**
 * Resolves dashboard API proxy paths to engine socket paths.
 * Expects: pathname starts with `/`; search is either empty or starts with `?`.
 */
export function dashboardProxyPathResolve(pathname: string, search: string): string {
    if (pathname === "/api") {
        return `/${search}`;
    }

    const normalizedPath = pathname.startsWith("/api/") ? pathname.slice("/api".length) : pathname;
    return `${normalizedPath}${search}`;
}
