import type { AppPermissions, AppRuleSet } from "./appTypes.js";

/**
 * Validates and normalizes app permissions metadata.
 * Expects: permissions were parsed from PERMISSIONS.md.
 */
export function appPermissionsValidate(permissions: AppPermissions): AppPermissions {
    const sourceIntent = permissions.sourceIntent.trim();
    if (!sourceIntent) {
        throw new Error("App permissions require a non-empty sourceIntent.");
    }

    const rules = appRuleSetNormalize(permissions.rules);
    return {
        sourceIntent,
        rules
    };
}

function appRuleSetNormalize(rules: AppRuleSet): AppRuleSet {
    return {
        allow: appRuleArrayNormalize(rules.allow, "allow"),
        deny: appRuleArrayNormalize(rules.deny, "deny")
    };
}

function appRuleArrayNormalize(rules: AppRuleSet["allow"], kind: "allow" | "deny"): AppRuleSet["allow"] {
    const normalized = rules.map((rule) => {
        const text = rule.text.trim();
        if (!text) {
            throw new Error(`App permissions ${kind} rules cannot contain empty entries.`);
        }
        return rule.addedBy && rule.addedBy.trim().length > 0 ? { text, addedBy: rule.addedBy.trim() } : { text };
    });
    return normalized;
}
