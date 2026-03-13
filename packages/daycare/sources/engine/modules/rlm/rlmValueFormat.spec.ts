import { describe, expect, it } from "vitest";

import { rlmValueFormat } from "./rlmValueFormat.js";

describe("rlmValueFormat", () => {
    it("formats nested Maps recursively instead of collapsing them to empty objects", () => {
        const value = new Map<string, unknown>([
            ["payload", new Map<string, unknown>([["items", [1, null, new Map<string, unknown>([["ok", true]])]]])],
            ["notePresent", false]
        ]);

        expect(rlmValueFormat(value)).toBe('{"payload":{"items":[1,null,{"ok":true}]},"notePresent":false}');
    });
});
