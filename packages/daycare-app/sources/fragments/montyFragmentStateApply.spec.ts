import { createStateStore } from "@json-render/core";
import { describe, expect, it } from "vitest";
import { montyFragmentStateApply } from "./montyFragmentStateApply";

describe("montyFragmentStateApply", () => {
    it("replaces top-level keys", () => {
        const store = createStateStore({ count: 1, label: "old" });

        const next = montyFragmentStateApply(store, { count: 2 });

        expect(next).toEqual({ count: 2, label: "old" });
        expect(store.getSnapshot()).toEqual({ count: 2, label: "old" });
    });

    it("deep-merges nested objects", () => {
        const store = createStateStore({
            user: {
                name: "Ada",
                meta: {
                    role: "admin",
                    active: false
                }
            }
        });

        montyFragmentStateApply(store, {
            user: {
                meta: {
                    active: true
                }
            }
        });

        expect(store.getSnapshot()).toEqual({
            user: {
                name: "Ada",
                meta: {
                    role: "admin",
                    active: true
                }
            }
        });
    });

    it("throws for non-object patches", () => {
        const store = createStateStore({ count: 1 });

        expect(() => montyFragmentStateApply(store, 42)).toThrow(
            "apply() expects a dict or callable returning a dict."
        );
    });
});
