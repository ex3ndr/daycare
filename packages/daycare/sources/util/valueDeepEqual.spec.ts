import { describe, expect, it } from "vitest";

import { valueDeepEqual } from "./valueDeepEqual.js";

describe("valueDeepEqual", () => {
    it("matches nested objects regardless of key order", () => {
        expect(
            valueDeepEqual(
                {
                    settings: {
                        model: "gpt-5",
                        options: {
                            b: 2,
                            a: 1
                        }
                    }
                },
                {
                    settings: {
                        options: {
                            a: 1,
                            b: 2
                        },
                        model: "gpt-5"
                    }
                }
            )
        ).toBe(true);
    });

    it("detects value differences", () => {
        expect(
            valueDeepEqual(
                { items: ["a", "b"], nested: { enabled: true } },
                { items: ["a", "c"], nested: { enabled: true } }
            )
        ).toBe(false);
    });
});
