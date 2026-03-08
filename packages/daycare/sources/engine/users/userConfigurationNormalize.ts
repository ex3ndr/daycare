import type { UserConfiguration } from "./userConfigurationTypes.js";

const USER_CONFIGURATION_DEFAULT: UserConfiguration = {
    showHome: false,
    showApp: false
};

/**
 * Normalizes persisted user configuration into the current flag shape.
 * Expects: input may be null, missing, or partially malformed JSON from storage.
 */
export function userConfigurationNormalize(input: unknown): UserConfiguration {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        return { ...USER_CONFIGURATION_DEFAULT };
    }

    const value = input as Record<string, unknown>;
    return {
        showHome: value.showHome === true,
        showApp: value.showApp === true
    };
}
