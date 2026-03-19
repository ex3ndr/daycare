import type { DaycareRole } from "../utils/hasRole.js";
import { durableFunctionEnabled } from "./durableFunctionEnabled.js";
import { type DurableFunctionName, durableFunctionDefinitions } from "./durableFunctions.js";

/**
 * Returns the durable functions enabled for the provided runtime roles.
 * Expects: an empty role list means "no role filter" to preserve local/dev behavior.
 */
export function durableFunctionNamesForRoles(roles: readonly DaycareRole[]): DurableFunctionName[] {
    return (Object.keys(durableFunctionDefinitions) as DurableFunctionName[]).filter((name) =>
        durableFunctionEnabled(name, roles)
    );
}
