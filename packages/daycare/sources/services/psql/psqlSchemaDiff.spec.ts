import { describe, expect, it } from "vitest";
import { psqlSchemaDiff } from "./psqlSchemaDiff.js";

describe("psqlSchemaDiff", () => {
    it("detects new table creation", () => {
        const desired = {
            name: "companies",
            comment: "Company records",
            columns: [{ name: "name", type: "text" as const, comment: "Company name" }]
        };

        const result = psqlSchemaDiff(desired, null);
        expect(result.errors).toEqual([]);
        expect(result.changes).toEqual([
            {
                kind: "table_add",
                table: {
                    name: "companies",
                    comment: "Company records",
                    columns: [{ name: "name", type: "text", comment: "Company name", nullable: false }]
                }
            }
        ]);
    });

    it("detects added fields on an existing table", () => {
        const current = {
            name: "contacts",
            comment: "Contact records",
            columns: [{ name: "first_name", type: "text" as const, comment: "Given name" }]
        };
        const desired = {
            name: "contacts",
            comment: "Contact records",
            columns: [
                { name: "first_name", type: "text" as const, comment: "Given name" },
                { name: "age", type: "integer" as const, comment: "Age in years", nullable: true }
            ]
        };

        const result = psqlSchemaDiff(desired, current);
        expect(result.errors).toEqual([]);
        expect(result.changes).toEqual([
            {
                kind: "column_add",
                table: "contacts",
                column: { name: "age", type: "integer", comment: "Age in years", nullable: true }
            }
        ]);
    });

    it("rejects removals", () => {
        const current = {
            name: "contacts",
            comment: "Contact records",
            columns: [
                { name: "first_name", type: "text" as const, comment: "Given name" },
                { name: "age", type: "integer" as const, comment: "Age in years" }
            ]
        };
        const desired = {
            name: "contacts",
            comment: "Contact records",
            columns: [{ name: "first_name", type: "text" as const, comment: "Given name" }]
        };

        const result = psqlSchemaDiff(desired, current);
        expect(result.errors).toContain("Column removal is not allowed: contacts.age");
    });

    it("rejects type changes", () => {
        const current = {
            name: "contacts",
            comment: "Contact records",
            columns: [{ name: "age", type: "integer" as const, comment: "Age in years" }]
        };
        const desired = {
            name: "contacts",
            comment: "Contact records",
            columns: [{ name: "age", type: "text" as const, comment: "Age in years" }]
        };

        const result = psqlSchemaDiff(desired, current);
        expect(result.errors).toContain("Column type change is not allowed: contacts.age integer -> text");
    });

    it("rejects table name mismatch", () => {
        const current = {
            name: "contacts",
            comment: "Contact records",
            columns: [{ name: "name", type: "text" as const, comment: "Name" }]
        };
        const desired = {
            name: "people",
            comment: "People records",
            columns: [{ name: "name", type: "text" as const, comment: "Name" }]
        };
        const result = psqlSchemaDiff(desired, current);
        expect(result.errors).toEqual(["Table name mismatch is not allowed: contacts -> people"]);
    });

    it("rejects field removals in field-level diff", () => {
        const current = {
            name: "contacts",
            comment: "Contact records",
            columns: [{ name: "name", type: "text" as const, comment: "Name" }]
        };
        const desired = {
            name: "contacts",
            comment: "Contact records",
            columns: []
        };

        const result = psqlSchemaDiff(desired, current);
        expect(result.errors).toEqual(["Column removal is not allowed: contacts.name"]);
    });

    it("detects comment updates", () => {
        const current = {
            name: "contacts",
            comment: "",
            columns: [{ name: "first_name", type: "text" as const, comment: "" }]
        };
        const desired = {
            name: "contacts",
            comment: "Contact records",
            columns: [{ name: "first_name", type: "text" as const, comment: "Given name" }]
        };
        const result = psqlSchemaDiff(desired, current);
        expect(result.errors).toEqual([]);
        expect(result.changes).toEqual([
            { kind: "table_comment_set", table: "contacts", comment: "Contact records" },
            {
                kind: "column_comment_set",
                table: "contacts",
                column: "first_name",
                comment: "Given name"
            }
        ]);
    });
});
