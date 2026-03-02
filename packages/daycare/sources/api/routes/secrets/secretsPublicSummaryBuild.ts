import type { Secret } from "../../../engine/secrets/secretTypes.js";
import type { SecretPublicSummary } from "./secretsTypes.js";

/**
 * Converts a stored secret into API-safe metadata.
 * Expects: secret.variables may contain sensitive values and must never be returned.
 */
export function secretsPublicSummaryBuild(secret: Secret): SecretPublicSummary {
    const variableNames = Object.keys(secret.variables).sort((left, right) => left.localeCompare(right));
    return {
        name: secret.name,
        displayName: secret.displayName,
        description: secret.description,
        variableNames,
        variableCount: variableNames.length
    };
}
