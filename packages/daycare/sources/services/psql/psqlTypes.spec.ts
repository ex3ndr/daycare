import { describe, expect, it } from "vitest";
import { psqlDataOpIs, psqlSchemaDeclarationIs, psqlTableSchemaApplyIs } from "./psqlTypes.js";

describe("psqlTypes guards", () => {
    it("accepts valid schema declarations", () => {
        expect(
            psqlSchemaDeclarationIs({
                tables: [
                    {
                        name: "contacts",
                        comment: "Contact records",
                        columns: [
                            { name: "first_name", type: "text", comment: "Given name" },
                            { name: "age", type: "integer", comment: "Age in years", nullable: true }
                        ]
                    }
                ]
            })
        ).toBe(true);
    });

    it("rejects invalid schema declarations", () => {
        expect(psqlSchemaDeclarationIs(null)).toBe(false);
        expect(psqlSchemaDeclarationIs({})).toBe(false);
        expect(
            psqlSchemaDeclarationIs({
                tables: [{ name: "x", comment: "", columns: [{ name: "c", type: "bigint", comment: "value" }] }]
            })
        ).toBe(false);
    });

    it("accepts valid single-table schema apply payload", () => {
        expect(
            psqlTableSchemaApplyIs({
                table: "contacts",
                comment: "Contact records",
                fields: [
                    { name: "first_name", type: "text", comment: "Given name" },
                    { name: "age", type: "integer", comment: "Age in years", nullable: true }
                ]
            })
        ).toBe(true);
    });

    it("rejects invalid single-table schema apply payload", () => {
        expect(psqlTableSchemaApplyIs(null)).toBe(false);
        expect(
            psqlTableSchemaApplyIs({
                table: "",
                comment: "Contact records",
                fields: [{ name: "age", type: "integer", comment: "Age in years" }]
            })
        ).toBe(false);
        expect(
            psqlTableSchemaApplyIs({
                table: "contacts",
                comment: "Contact records",
                fields: [{ name: "age", type: "bigint", comment: "Age in years" }]
            })
        ).toBe(false);
    });

    it("accepts discriminated data ops", () => {
        expect(psqlDataOpIs({ op: "add", table: "contacts", data: { first_name: "Ada" } })).toBe(true);
        expect(psqlDataOpIs({ op: "update", table: "contacts", id: "row1", data: { age: 30 } })).toBe(true);
        expect(psqlDataOpIs({ op: "delete", table: "contacts", id: "row1" })).toBe(true);
    });

    it("rejects malformed data ops", () => {
        expect(psqlDataOpIs({ op: "add", table: "contacts" })).toBe(false);
        expect(psqlDataOpIs({ op: "update", table: "contacts", id: "row1" })).toBe(false);
        expect(psqlDataOpIs({ op: "delete", table: "contacts" })).toBe(false);
        expect(psqlDataOpIs({ op: "unknown", table: "contacts" })).toBe(false);
    });
});
