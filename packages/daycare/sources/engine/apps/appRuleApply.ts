import { promises as fs } from "node:fs";
import path from "node:path";

import { appPermissionsParse } from "./appPermissionsParse.js";
import { appPermissionsSerialize } from "./appPermissionsSerialize.js";
import { appPermissionsValidate } from "./appPermissionsValidate.js";
import type { AppPermissions } from "./appTypes.js";

export type AppRuleAction = "add_deny" | "add_allow" | "remove_deny" | "remove_allow";

type AppRuleApplyInput = {
    appDir: string;
    action: AppRuleAction;
    rule: string;
    addedBy?: string;
};

type AppRuleApplyResult = {
    permissions: AppPermissions;
    changed: boolean;
    message: string;
};

/**
 * Applies one rule change action to app permissions and persists PERMISSIONS.md.
 * Expects: appDir points to an installed app folder with PERMISSIONS.md.
 */
export async function appRuleApply(input: AppRuleApplyInput): Promise<AppRuleApplyResult> {
    const ruleText = input.rule.trim();
    if (!ruleText) {
        throw new Error("Rule text is required.");
    }
    const permissionsPath = path.join(path.resolve(input.appDir), "PERMISSIONS.md");
    const raw = await fs.readFile(permissionsPath, "utf8");
    const permissions = appPermissionsValidate(appPermissionsParse(raw));

    const next = structuredClone(permissions);
    let changed = false;
    let message = "No changes applied.";

    if (input.action === "add_deny" || input.action === "add_allow") {
        const bucket = input.action === "add_deny" ? next.rules.deny : next.rules.allow;
        if (!bucket.some((rule) => rule.text === ruleText)) {
            bucket.push(input.addedBy ? { text: ruleText, addedBy: input.addedBy } : { text: ruleText });
            changed = true;
            message = `Rule added to ${input.action === "add_deny" ? "deny" : "allow"} list.`;
        } else {
            message = "Rule already exists; no change made.";
        }
    } else {
        const bucket = input.action === "remove_deny" ? next.rules.deny : next.rules.allow;
        const index = bucket.findIndex((rule) => rule.text === ruleText);
        if (index >= 0) {
            bucket.splice(index, 1);
            changed = true;
            message = `Rule removed from ${input.action === "remove_deny" ? "deny" : "allow"} list.`;
        } else {
            message = "Rule not found; no change made.";
        }
    }

    const validated = appPermissionsValidate(next);
    if (changed) {
        await fs.writeFile(permissionsPath, appPermissionsSerialize(validated), "utf8");
    }

    return {
        permissions: validated,
        changed,
        message
    };
}
