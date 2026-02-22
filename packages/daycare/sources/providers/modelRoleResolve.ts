import type { ProviderSettings } from "../settings.js";

export type ModelRoleResolution = {
    providerId: string;
    model: string;
};

/**
 * Parses a "<providerId>/<modelName>" config string and validates
 * that the referenced provider exists in the active providers list.
 *
 * Returns null when the config is missing, malformed, or the provider is inactive.
 */
export function modelRoleResolve(
    config: string | undefined,
    providers: ProviderSettings[]
): ModelRoleResolution | null {
    if (!config) {
        return null;
    }

    const slashIndex = config.indexOf("/");
    if (slashIndex <= 0 || slashIndex === config.length - 1) {
        return null;
    }

    const providerId = config.slice(0, slashIndex);
    const model = config.slice(slashIndex + 1);

    const match = providers.find((p) => p.id === providerId);
    if (!match) {
        return null;
    }

    return { providerId, model };
}
