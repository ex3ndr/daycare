/**
 * Validates that the provided IANA timezone identifier is recognized by Intl.
 */
export function timezoneIsValid(timezone: string): boolean {
    try {
        new Intl.DateTimeFormat("en-US", { timeZone: timezone });
        return true;
    } catch {
        return false;
    }
}
