import { describe, expect, it } from "vitest";
import { fragmentSpecValidate } from "./fragmentSpecValidate.js";

describe("fragmentSpecValidate", () => {
    it("accepts a valid spec with known components", () => {
        const result = fragmentSpecValidate({
            root: "main",
            elements: {
                main: { type: "View", props: { direction: "row", gap: "md" }, children: ["txt"] },
                txt: { type: "Text", props: { text: "hello" }, children: [] }
            }
        });
        expect(result.valid).toBe(true);
        expect(result.issues.filter((i) => i.severity === "error")).toHaveLength(0);
    });

    it("rejects non-object spec", () => {
        const result = fragmentSpecValidate("not an object");
        expect(result.valid).toBe(false);
        expect(result.issues).toHaveLength(1);
        expect(result.issues[0]!.message).toContain("must be an object");
    });

    it("rejects missing root", () => {
        const result = fragmentSpecValidate({ elements: { a: { type: "View" } } });
        expect(result.valid).toBe(false);
        expect(result.issues[0]!.message).toContain("root");
    });

    it("rejects missing elements", () => {
        const result = fragmentSpecValidate({ root: "main" });
        expect(result.valid).toBe(false);
        expect(result.issues[0]!.message).toContain("elements");
    });

    it("rejects root referencing missing element", () => {
        const result = fragmentSpecValidate({
            root: "missing",
            elements: { main: { type: "View", children: [] } }
        });
        expect(result.valid).toBe(false);
        expect(result.issues[0]!.message).toContain('Root "missing" not found');
    });

    it("rejects unknown component type", () => {
        const result = fragmentSpecValidate({
            root: "main",
            elements: { main: { type: "FakeComponent", props: {}, children: [] } }
        });
        expect(result.valid).toBe(false);
        expect(result.issues[0]!.message).toContain('unknown type "FakeComponent"');
    });

    it("warns about unknown props", () => {
        const result = fragmentSpecValidate({
            root: "main",
            elements: { main: { type: "Text", props: { text: "hi", bogus: true }, children: [] } }
        });
        expect(result.valid).toBe(true);
        expect(result.issues).toHaveLength(1);
        expect(result.issues[0]!.severity).toBe("warning");
        expect(result.issues[0]!.message).toContain('unknown prop "bogus"');
    });

    it("detects visible inside props", () => {
        const result = fragmentSpecValidate({
            root: "main",
            elements: { main: { type: "View", props: { visible: true }, children: [] } }
        });
        expect(result.valid).toBe(false);
        expect(result.issues.some((i) => i.message.includes('"visible" should be on the element'))).toBe(true);
    });

    it("detects missing child reference", () => {
        const result = fragmentSpecValidate({
            root: "main",
            elements: { main: { type: "View", props: {}, children: ["nonexistent"] } }
        });
        expect(result.valid).toBe(false);
        expect(result.issues[0]!.message).toContain('missing child "nonexistent"');
    });

    it("warns about orphaned elements", () => {
        const result = fragmentSpecValidate({
            root: "main",
            elements: {
                main: { type: "View", props: {}, children: [] },
                orphan: { type: "Text", props: { text: "lost" }, children: [] }
            }
        });
        expect(result.valid).toBe(true);
        expect(result.issues).toHaveLength(1);
        expect(result.issues[0]!.severity).toBe("warning");
        expect(result.issues[0]!.message).toContain("not reachable");
    });
});
