import type { AppPermissions, AppRule } from "./appTypes.js";

/**
 * Parses PERMISSIONS.md content into an AppPermissions shape.
 * Expects: markdown contains `## Source Intent` and `## Rules` sections.
 */
export function appPermissionsParse(content: string): AppPermissions {
    const sourceIntent = markdownSectionRead(content, "Source Intent", 2);
    if (!sourceIntent) {
        throw new Error("PERMISSIONS.md must include a non-empty `## Source Intent` section.");
    }

    const rulesBody = markdownSectionRead(content, "Rules", 2);
    const allowBody = markdownSectionRead(rulesBody, "Allow", 3);
    const denyBody = markdownSectionRead(rulesBody, "Deny", 3);
    return {
        sourceIntent,
        rules: {
            allow: markdownRulesParse(allowBody),
            deny: markdownRulesParse(denyBody)
        }
    };
}

function markdownSectionRead(markdown: string, heading: string, level: 2 | 3): string {
    const lines = markdown.split("\n");
    const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const headingPattern = new RegExp(`^${"#".repeat(level)}\\s+${escapedHeading}\\s*$`, "i");
    const stopPattern = level === 2 ? /^##\s+/ : /^##\s+|^###\s+/;
    let collecting = false;
    const sectionLines: string[] = [];
    for (const line of lines) {
        if (!collecting) {
            if (headingPattern.test(line.trim())) {
                collecting = true;
            }
            continue;
        }
        if (stopPattern.test(line.trim())) {
            break;
        }
        sectionLines.push(line);
    }
    return sectionLines.join("\n").trim();
}

function markdownRulesParse(body: string): AppRule[] {
    if (!body) {
        return [];
    }
    const rules: AppRule[] = [];
    for (const line of body.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("- ")) {
            continue;
        }
        const text = trimmed.slice(2).trim();
        if (!text) {
            continue;
        }
        rules.push({ text });
    }
    return rules;
}
