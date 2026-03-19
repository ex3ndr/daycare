import type { DaycareRole } from "../utils/hasRole.js";
import { durableFunctionDefinitionGet } from "./durableFunctionDefinitionGet.js";
import type { DurableFunctionName } from "./durableFunctions.js";

/**
 * Returns whether a durable function is enabled for the provided runtime roles.
 * Expects: an empty role list means "no role filter" to preserve local/dev behavior.
 */
export function durableFunctionEnabled<TName extends DurableFunctionName>(
    name: TName,
    roles: readonly DaycareRole[]
): boolean {
    const enabledRoles = durableFunctionDefinitionGet(name).enabledRoles;
    if (!enabledRoles || enabledRoles.length === 0 || roles.length === 0) {
        return true;
    }
    return enabledRoles.some((role) => roles.includes(role));
}
