import { describe, expect, it } from "vitest";

import { permissionTagsNormalize } from "./permissionTagsNormalize.js";

describe("permissionTagsNormalize", () => {
    it("normalizes and dedupes permission tags", () => {
        const result = permissionTagsNormalize([
            " @network ",
            "@events",
            "@workspace",
            "@read:/tmp",
            "@read:/tmp",
            "@write:/var/log"
        ]);
        expect(result).toEqual(["@network", "@events", "@workspace", "@read:/tmp", "@write:/var/log"]);
    });

    it("returns empty for missing values", () => {
        expect(permissionTagsNormalize(undefined)).toEqual([]);
    });
});
