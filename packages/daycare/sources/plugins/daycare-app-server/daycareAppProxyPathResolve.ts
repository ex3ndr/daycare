/**
 * Resolves app server API proxy paths to engine socket paths.
 * Expects: pathname starts with `/`; search is empty or starts with `?`.
 */
export function daycareAppProxyPathResolve(pathname: string, search: string): string {
    if (pathname === "/api") {
        return `/${search}`;
    }

    const normalizedPath = pathname.startsWith("/api/") ? pathname.slice("/api".length) : pathname;
    return `${normalizedPath}${search}`;
}
