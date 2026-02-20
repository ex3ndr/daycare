import type { AppPermissions } from "./appTypes.js";

/**
 * Serializes app permissions back to PERMISSIONS.md markdown format.
 * Expects: permissions have already been validated and normalized.
 */
export function appPermissionsSerialize(permissions: AppPermissions): string {
    return [
        "## Source Intent",
        "",
        permissions.sourceIntent.trim(),
        "",
        "## Rules",
        "",
        "### Allow",
        ...permissions.rules.allow.map((rule) => `- ${rule.text}`),
        "",
        "### Deny",
        ...permissions.rules.deny.map((rule) => `- ${rule.text}`)
    ]
        .join("\n")
        .trimEnd();
}
