import { describe, expect, it } from "vitest";
import { fragmentCodeVerify } from "./fragmentCodeVerify.js";

describe("fragmentCodeVerify", () => {
    it("accepts valid fragment python with referenced custom actions", () => {
        const result = fragmentCodeVerify({
            root: "main",
            code: [
                "def init():",
                '    return {"count": 0}',
                "",
                "def increment(state, params):",
                '    return {"count": state.get("count", 0) + params.get("amount", 1)}'
            ].join("\n"),
            elements: {
                main: {
                    type: "Button",
                    on: {
                        press: {
                            action: "increment",
                            params: { amount: 1 }
                        }
                    },
                    children: []
                }
            }
        });

        expect(result).toBeNull();
    });

    it("rejects syntax errors", () => {
        const result = fragmentCodeVerify({
            root: "main",
            code: "def init(:\n    return {}",
            elements: {
                main: { type: "View", children: [] }
            }
        });

        expect(result).toContain("Fragment Python syntax error.");
    });

    it("rejects missing custom action functions", () => {
        const result = fragmentCodeVerify({
            root: "main",
            code: "def init():\n    return {}",
            elements: {
                main: {
                    type: "Button",
                    on: {
                        press: {
                            action: "increment",
                            params: {}
                        }
                    },
                    children: []
                }
            }
        });

        expect(result).toContain("Fragment Python runtime error.");
    });

    it("ignores built-in actions", () => {
        const result = fragmentCodeVerify({
            root: "main",
            code: "value = 1",
            elements: {
                main: {
                    type: "Button",
                    on: {
                        press: {
                            action: "setState",
                            params: {
                                statePath: "/count",
                                value: 1
                            }
                        }
                    },
                    children: []
                }
            }
        });

        expect(result).toBeNull();
    });
});
