import { describe, expect, it } from "vitest";

import { appPermissionsSerialize } from "./appPermissionsSerialize.js";

describe("appPermissionsSerialize", () => {
    it("serializes source intent and rules into markdown", () => {
        const output = appPermissionsSerialize({
            sourceIntent: "Review pull requests safely.",
            rules: {
                allow: [{ text: "Read files" }],
                deny: [{ text: "Delete files" }]
            }
        });

        expect(output).toContain("## Source Intent");
        expect(output).toContain("Review pull requests safely.");
        expect(output).toContain("### Allow");
        expect(output).toContain("- Read files");
        expect(output).toContain("### Deny");
        expect(output).toContain("- Delete files");
    });
});
