import { describe, expect, it } from "vitest";

import { appPermissionsParse } from "./appPermissionsParse.js";

describe("appPermissionsParse", () => {
    it("parses source intent and allow/deny rules", () => {
        const permissions = appPermissionsParse(
            [
                "## Source Intent",
                "",
                "Review pull requests safely.",
                "",
                "## Rules",
                "",
                "### Allow",
                "- Read files",
                "",
                "### Deny",
                "- Delete files"
            ].join("\n")
        );

        expect(permissions).toEqual({
            sourceIntent: "Review pull requests safely.",
            rules: {
                allow: [{ text: "Read files" }],
                deny: [{ text: "Delete files" }]
            }
        });
    });

    it("throws when source intent is missing", () => {
        expect(() => appPermissionsParse("## Rules\n\n### Allow\n- Read files\n\n### Deny\n- Delete files")).toThrow(
            "PERMISSIONS.md must include a non-empty `## Source Intent` section."
        );
    });
});
