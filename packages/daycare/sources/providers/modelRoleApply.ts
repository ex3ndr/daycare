import type { ProviderSettings } from "../settings.js";
import { modelRoleResolve } from "./modelRoleResolve.js";

export type ModelRoleApplyResult = {
    providers: ProviderSettings[];
    providerId: string | null;
};

/**
 * Applies a role-based model config string to the provider list.
 * Moves the target provider to the front and overrides its model.
 *
 * Returns the original providers unchanged when config is undefined or the provider is not found.
 */
export function modelRoleApply(providers: ProviderSettings[], modelConfig: string | undefined): ModelRoleApplyResult {
    const resolved = modelRoleResolve(modelConfig, providers);
    if (!resolved) {
        return { providers, providerId: null };
    }

    const updated = providers.map((p) => {
        if (p.id === resolved.providerId) {
            return { ...p, model: resolved.model };
        }
        return p;
    });

    // Move target provider to front so it's selected as the active provider
    const target = updated.find((p) => p.id === resolved.providerId);
    if (target) {
        const rest = updated.filter((p) => p.id !== resolved.providerId);
        return { providers: [target, ...rest], providerId: resolved.providerId };
    }

    return { providers: updated, providerId: resolved.providerId };
}
