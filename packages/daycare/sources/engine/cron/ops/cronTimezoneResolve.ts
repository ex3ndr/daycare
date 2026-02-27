import { timezoneIsValid } from "../../../util/timezoneIsValid.js";

/**
 * Resolves cron timezone from explicit input and user profile fallback.
 *
 * Expects: optional IANA timezone identifiers; explicit timezone wins.
 * Returns: explicit timezone, then profile timezone, else UTC.
 */
export function cronTimezoneResolve(input: {
    timezone?: string | null;
    profileTimezone?: string | null;
}): string {
    const provided = input.timezone?.trim() ?? "";
    if (provided) {
        if (!timezoneIsValid(provided)) {
            throw new Error(`Invalid cron timezone: ${provided}`);
        }
        return provided;
    }

    const profileTimezone = input.profileTimezone?.trim() ?? "";
    if (profileTimezone && timezoneIsValid(profileTimezone)) {
        return profileTimezone;
    }

    return "UTC";
}
