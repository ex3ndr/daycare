/**
 * Resolves the active dev sub-route segment from a pathname.
 * Supports both `/dev/<item>` and `/<workspace>/dev/<item>` forms.
 */
export function devPathSegmentResolve(pathname: string): string | undefined {
    const parts = pathname.split("/").filter(Boolean);
    if (parts[0] === "dev") {
        return parts[1];
    }
    if (parts[1] === "dev") {
        return parts[2];
    }
    return undefined;
}
