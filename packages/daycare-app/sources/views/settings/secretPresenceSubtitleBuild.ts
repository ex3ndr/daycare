import type { SecretSummary } from "@/modules/secrets/secretsTypes";

/**
 * Builds a presence-only subtitle string for a saved secret summary.
 * Expects: summary comes from the metadata-only app secrets API response.
 */
export function secretPresenceSubtitleBuild(summary: SecretSummary): string {
    const parts: string[] = [];
    const description = summary.description.trim();
    if (description.length > 0) {
        parts.push(description);
    }
    if (summary.variableNames.length > 0) {
        parts.push(`Variables: ${summary.variableNames.join(", ")}`);
    } else {
        parts.push("Variables: none configured");
    }
    return parts.join("\n");
}
