import { describe, expect, it } from "vitest";

import { rlmRuntimeToolExecute } from "./rlmRuntimeToolExecute.js";

describe("rlmRuntimeToolExecute", () => {
    it("returns not handled for non-runtime tools", () => {
        const result = rlmRuntimeToolExecute("echo", { text: "hello" });
        expect(result).toEqual({ handled: false });
    });

    it("parses json_parse text input into structured value", () => {
        const result = rlmRuntimeToolExecute("json_parse", { text: '{"ok":true,"rows":[1,2]}' });
        expect(result).toEqual({
            handled: true,
            value: {
                value: {
                    ok: true,
                    rows: [1, 2]
                }
            }
        });
    });

    it("serializes json_stringify with optional pretty output", () => {
        const result = rlmRuntimeToolExecute("json_stringify", {
            value: { ok: true },
            pretty: true
        });
        expect(result).toEqual({
            handled: true,
            value: {
                value: '{\n  "ok": true\n}'
            }
        });
    });

    it("throws on invalid json_parse input", () => {
        expect(() => rlmRuntimeToolExecute("json_parse", { text: "{invalid" })).toThrow();
    });
});
