export function cuid2Is(value: string | null | undefined): value is string {
    return typeof value === "string" && /^[a-z0-9]{24,32}$/.test(value);
}
