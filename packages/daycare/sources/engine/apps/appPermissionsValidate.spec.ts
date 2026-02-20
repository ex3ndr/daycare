import { describe, expect, it } from "vitest";
import { appPermissionsValidate } from "./appPermissionsValidate.js";
import type { AppPermissions } from "./appTypes.js";

function basePermissions(): AppPermissions {
    return {
        sourceIntent: "Review pull requests safely.",
        rules: {
            allow: [{ text: "Read files" }],
            deny: [{ text: "Delete files" }]
        }
    };
}

describe("appPermissionsValidate", () => {
    it("accepts valid app permissions", () => {
        const validated = appPermissionsValidate(basePermissions());
        expect(validated.sourceIntent).toBe("Review pull requests safely.");
        expect(validated.rules.allow).toEqual([{ text: "Read files" }]);
    });

    it("rejects blank source intent", () => {
        const permissions = basePermissions();
        permissions.sourceIntent = "   ";

        expect(() => appPermissionsValidate(permissions)).toThrow("App permissions require a non-empty sourceIntent.");
    });

    it("rejects empty rule text", () => {
        const permissions = basePermissions();
        permissions.rules.deny = [{ text: "   " }];

        expect(() => appPermissionsValidate(permissions)).toThrow(
            "App permissions deny rules cannot contain empty entries."
        );
    });
});
