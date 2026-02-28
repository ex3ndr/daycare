import { describe, expect, it } from "vitest";
import type { TaskParameter } from "./taskParameterTypes.js";
import { taskParameterCodePrepend, taskParameterPreambleStubs } from "./taskParameterCodegen.js";

describe("taskParameterCodePrepend", () => {
    it("prepends string variable", () => {
        const params: TaskParameter[] = [{ name: "city", type: "string", nullable: false }];
        const result = taskParameterCodePrepend("print(city)", params, { city: "Seoul" });
        expect(result).toBe('city: str = """Seoul"""\n\nprint(city)');
    });

    it("prepends number variable", () => {
        const params: TaskParameter[] = [{ name: "count", type: "number", nullable: false }];
        const result = taskParameterCodePrepend("print(count)", params, { count: 42 });
        expect(result).toBe("count: int | float = 42\n\nprint(count)");
    });

    it("prepends boolean variable", () => {
        const params: TaskParameter[] = [{ name: "verbose", type: "boolean", nullable: false }];
        const result = taskParameterCodePrepend("print(verbose)", params, { verbose: true });
        expect(result).toBe("verbose: bool = True\n\nprint(verbose)");
    });

    it("prepends false boolean", () => {
        const params: TaskParameter[] = [{ name: "verbose", type: "boolean", nullable: false }];
        const result = taskParameterCodePrepend("print(verbose)", params, { verbose: false });
        expect(result).toBe("verbose: bool = False\n\nprint(verbose)");
    });

    it("prepends any type", () => {
        const params: TaskParameter[] = [{ name: "data", type: "any", nullable: false }];
        const result = taskParameterCodePrepend("print(data)", params, { data: 42 });
        expect(result).toBe("data: Any = 42\n\nprint(data)");
    });

    it("handles nullable with null value", () => {
        const params: TaskParameter[] = [{ name: "city", type: "string", nullable: true }];
        const result = taskParameterCodePrepend("print(city)", params, { city: null });
        expect(result).toBe("city: str | None = None\n\nprint(city)");
    });

    it("handles nullable with missing value", () => {
        const params: TaskParameter[] = [{ name: "city", type: "string", nullable: true }];
        const result = taskParameterCodePrepend("print(city)", params, {});
        expect(result).toBe("city: str | None = None\n\nprint(city)");
    });

    it("handles nullable with provided value", () => {
        const params: TaskParameter[] = [{ name: "city", type: "string", nullable: true }];
        const result = taskParameterCodePrepend("print(city)", params, { city: "Seoul" });
        expect(result).toBe('city: str | None = """Seoul"""\n\nprint(city)');
    });

    it("prepends multiple variables", () => {
        const params: TaskParameter[] = [
            { name: "city", type: "string", nullable: false },
            { name: "count", type: "number", nullable: true }
        ];
        const result = taskParameterCodePrepend("print(city, count)", params, { city: "Seoul", count: 5 });
        expect(result).toBe('city: str = """Seoul"""\ncount: int | float | None = 5\n\nprint(city, count)');
    });

    it("returns original code for empty params", () => {
        const result = taskParameterCodePrepend("print('hello')", [], {});
        expect(result).toBe("print('hello')");
    });

    it("serializes object as JSON string", () => {
        const params: TaskParameter[] = [{ name: "config", type: "any", nullable: false }];
        const result = taskParameterCodePrepend("print(config)", params, { config: { key: "value" } });
        expect(result).toContain('{"key":"value"}');
        expect(result).toContain("config: Any = ");
    });
});

describe("taskParameterPreambleStubs", () => {
    it("generates stub for required string", () => {
        const params: TaskParameter[] = [{ name: "city", type: "string", nullable: false }];
        expect(taskParameterPreambleStubs(params)).toBe("city: str");
    });

    it("generates stub for nullable number", () => {
        const params: TaskParameter[] = [{ name: "count", type: "number", nullable: true }];
        expect(taskParameterPreambleStubs(params)).toBe("count: int | float | None");
    });

    it("generates stub for boolean", () => {
        const params: TaskParameter[] = [{ name: "verbose", type: "boolean", nullable: false }];
        expect(taskParameterPreambleStubs(params)).toBe("verbose: bool");
    });

    it("generates stub for any", () => {
        const params: TaskParameter[] = [{ name: "data", type: "any", nullable: false }];
        expect(taskParameterPreambleStubs(params)).toBe("data: Any");
    });

    it("generates multiple stubs", () => {
        const params: TaskParameter[] = [
            { name: "city", type: "string", nullable: false },
            { name: "count", type: "number", nullable: true }
        ];
        expect(taskParameterPreambleStubs(params)).toBe("city: str\ncount: int | float | None");
    });

    it("returns empty string for empty params", () => {
        expect(taskParameterPreambleStubs([])).toBe("");
    });
});
