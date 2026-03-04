import { PGlite } from "@electric-sql/pglite";
import { afterEach, describe, expect, it } from "vitest";
import { psqlSchemaApply } from "./psqlSchemaApply.js";
import { psqlSchemaDiff } from "./psqlSchemaDiff.js";
import { psqlSchemaIntrospect } from "./psqlSchemaIntrospect.js";

describe("psqlSchemaApply", () => {
    const databases: PGlite[] = [];

    afterEach(async () => {
        await Promise.all(databases.map(async (db) => db.close()));
        databases.length = 0;
    });

    it("creates tables and adds columns", async () => {
        const db = new PGlite();
        databases.push(db);

        const firstDesired = {
            name: "contacts",
            comment: "Contact records",
            columns: [{ name: "first_name", type: "text" as const, comment: "Given name" }]
        };

        const firstDiff = psqlSchemaDiff(firstDesired, null);
        await psqlSchemaApply(db, firstDiff);

        let schema = await psqlSchemaIntrospect(db);
        expect(schema).toEqual({
            tables: [
                {
                    name: "contacts",
                    comment: "Contact records",
                    columns: [{ name: "first_name", type: "text", comment: "Given name", nullable: false }]
                }
            ]
        });

        const nextDesired = {
            name: "contacts",
            comment: "Contact records",
            columns: [
                { name: "first_name", type: "text" as const, comment: "Given name" },
                { name: "age", type: "integer" as const, comment: "Age in years", nullable: true }
            ]
        };

        const currentTable = schema.tables.find((table) => table.name === "contacts") ?? null;
        const nextDiff = psqlSchemaDiff(nextDesired, currentTable);
        await psqlSchemaApply(db, nextDiff);

        schema = await psqlSchemaIntrospect(db);
        expect(schema).toEqual({
            tables: [
                {
                    name: "contacts",
                    comment: "Contact records",
                    columns: [
                        { name: "first_name", type: "text", comment: "Given name", nullable: false },
                        { name: "age", type: "integer", comment: "Age in years", nullable: true }
                    ]
                }
            ]
        });
    });

    it("rejects apply when diff has errors", async () => {
        const db = new PGlite();
        databases.push(db);

        await expect(psqlSchemaApply(db, { changes: [], errors: ["x"] })).rejects.toThrow("blocking errors");
    });
});
