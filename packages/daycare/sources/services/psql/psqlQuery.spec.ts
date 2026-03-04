import { PGlite } from "@electric-sql/pglite";
import { afterEach, describe, expect, it } from "vitest";
import { psqlQuery } from "./psqlQuery.js";

describe("psqlQuery", () => {
    const databases: PGlite[] = [];

    afterEach(async () => {
        await Promise.all(databases.map(async (db) => db.close()));
        databases.length = 0;
    });

    it("executes read-only select statements", async () => {
        const db = new PGlite();
        databases.push(db);

        await db.exec("CREATE TABLE contacts (id text NOT NULL, name text NOT NULL)");
        await db.query('INSERT INTO "contacts" (id, name) VALUES ($1, $2)', ["1", "Ada"]);

        const rows = await psqlQuery(db, 'SELECT name FROM "contacts" WHERE id = $1', ["1"]);
        expect(rows).toEqual([{ name: "Ada" }]);
    });

    it("rejects obvious write statements", async () => {
        const db = new PGlite();
        databases.push(db);

        await db.exec("CREATE TABLE contacts (id text NOT NULL)");

        await expect(psqlQuery(db, 'INSERT INTO "contacts" (id) VALUES ($1)', ["1"])).rejects.toThrow(
            "read-only transaction"
        );
    });

    it("fails write attempts inside read-only transactions", async () => {
        const db = new PGlite();
        databases.push(db);

        await db.exec("CREATE TABLE contacts (id text NOT NULL)");

        await expect(
            psqlQuery(db, "WITH x AS (SELECT 1) INSERT INTO \"contacts\" (id) VALUES ('1')")
        ).rejects.toThrow();
    });

    it("does not block read queries based on keywords in text literals", async () => {
        const db = new PGlite();
        databases.push(db);

        const rows = await psqlQuery(db, "SELECT 'update' AS note");
        expect(rows).toEqual([{ note: "update" }]);
    });
});
