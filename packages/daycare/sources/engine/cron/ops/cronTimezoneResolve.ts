import { timezoneIsValid } from "../../../utils/timezoneIsValid.js";

/**
 * Resolves cron timezone from explicit input and user profile fallback.
 *
 * Expects: optional IANA timezone identifiers; explicit timezone wins.
 * Returns: explicit timezone, then profile timezone, else UTC by default.
 */
export function cronTimezoneResolve(input: {
    timezone?: string | null;
    profileTimezone?: string | null;
    requireResolved?: boolean;
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

    if (input.requireResolved === true) {
        throw new Error(
            "Timezone is required. Ask the user for timezone or set it in user profile (user_profile_update)."
        );
    }

    return "UTC";
}
