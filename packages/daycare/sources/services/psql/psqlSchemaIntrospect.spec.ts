import { PGlite } from "@electric-sql/pglite";
import { afterEach, describe, expect, it } from "vitest";
import { psqlSchemaIntrospect } from "./psqlSchemaIntrospect.js";

describe("psqlSchemaIntrospect", () => {
    const databases: PGlite[] = [];

    afterEach(async () => {
        await Promise.all(databases.map(async (db) => db.close()));
        databases.length = 0;
    });

    it("returns declaration format and excludes system columns", async () => {
        const db = new PGlite();
        databases.push(db);

        await db.exec(`
            CREATE TABLE contacts (
                id text NOT NULL,
                version integer NOT NULL,
                valid_from bigint NOT NULL,
                valid_to bigint,
                created_at bigint NOT NULL,
                updated_at bigint NOT NULL,
                first_name text NOT NULL,
                age integer
            )
        `);
        await db.exec("COMMENT ON TABLE contacts IS 'Contact records'");
        await db.exec("COMMENT ON COLUMN contacts.first_name IS 'Given name'");
        await db.exec("COMMENT ON COLUMN contacts.age IS 'Age in years'");

        const schema = await psqlSchemaIntrospect(db);

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
});
