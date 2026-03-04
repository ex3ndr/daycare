import { PGlite } from "@electric-sql/pglite";
import { afterEach, describe, expect, it } from "vitest";
import { psqlDataAdd } from "./psqlDataAdd.js";
import { psqlDataDelete } from "./psqlDataDelete.js";
import { psqlDataUpdate } from "./psqlDataUpdate.js";

const databases: PGlite[] = [];

describe("psql data operations", () => {
    afterEach(async () => {
        await Promise.all(databases.map(async (db) => db.close()));
        databases.length = 0;
    });

    it("adds rows with versioned system columns", async () => {
        const db = await databaseCreate();
        const row = await psqlDataAdd(db, "contacts", {
            first_name: "Ada",
            age: 36
        });

        expect(row.id).toEqual(expect.any(String));
        expect(row.version).toBe(1);
        expect(row.valid_to).toBeNull();
        expect(row.first_name).toBe("Ada");
        expect(row.age).toBe(36);
    });

    it("updates rows by closing old version and creating new current version", async () => {
        const db = await databaseCreate();
        const added = await psqlDataAdd(db, "contacts", {
            first_name: "Ada",
            age: 36
        });

        const updated = await psqlDataUpdate(db, "contacts", String(added.id), {
            age: 37
        });

        expect(updated.id).toBe(added.id);
        expect(updated.version).toBe(2);
        expect(updated.valid_to).toBeNull();
        expect(updated.first_name).toBe("Ada");
        expect(updated.age).toBe(37);

        const rows = await db.query<{ version: number; valid_to: number | null }>(
            'SELECT version, valid_to FROM "contacts" WHERE "id" = $1 ORDER BY version ASC',
            [added.id]
        );
        expect(rows.rows).toEqual([
            { version: 1, valid_to: expect.any(Number) },
            { version: 2, valid_to: null }
        ]);
    });

    it("deletes rows by closing the current version", async () => {
        const db = await databaseCreate();
        const added = await psqlDataAdd(db, "contacts", {
            first_name: "Ada",
            age: 36
        });

        const deleted = await psqlDataDelete(db, "contacts", String(added.id));
        expect(deleted.id).toBe(added.id);
        expect(deleted.version).toBe(1);
        expect(deleted.valid_to).toEqual(expect.any(Number));

        const rows = await db.query<{ version: number; valid_from: number; valid_to: number | null }>(
            'SELECT version, valid_from, valid_to FROM "contacts" WHERE "id" = $1 ORDER BY version ASC',
            [added.id]
        );
        expect(rows.rows).toEqual([{ version: 1, valid_from: expect.any(Number), valid_to: expect.any(Number) }]);
    });

    it("errors for missing rows or already deleted rows", async () => {
        const db = await databaseCreate();

        await expect(psqlDataUpdate(db, "contacts", "missing", { first_name: "X" })).rejects.toThrow("not found");
        await expect(psqlDataDelete(db, "contacts", "missing")).rejects.toThrow("not found");

        const added = await psqlDataAdd(db, "contacts", {
            first_name: "Ada",
            age: 36
        });
        await psqlDataDelete(db, "contacts", String(added.id));

        await expect(psqlDataDelete(db, "contacts", String(added.id))).rejects.toThrow("already deleted");
    });

    it("rolls back update when insert fails after closing current row", async () => {
        const db = await databaseCreate({ withAgeCheck: true });
        const added = await psqlDataAdd(db, "contacts", {
            first_name: "Ada",
            age: 36
        });

        await expect(psqlDataUpdate(db, "contacts", String(added.id), { age: -1 })).rejects.toThrow();

        const current = await db.query<{ version: number; valid_to: number | null; age: number | null }>(
            'SELECT version, valid_to, age FROM "contacts" WHERE "id" = $1 ORDER BY "version" ASC',
            [added.id]
        );
        expect(current.rows).toEqual([{ version: 1, valid_to: null, age: 36 }]);
    });
});

async function databaseCreate(options?: { withAgeCheck?: boolean }): Promise<PGlite> {
    const ageCheckSql = options?.withAgeCheck ? "CHECK (age IS NULL OR age >= 0)," : "";
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
            age integer,
            ${ageCheckSql}
            PRIMARY KEY (id, version)
        )
    `);
    await db.exec('CREATE UNIQUE INDEX idx_contacts_current_id ON "contacts" ("id") WHERE "valid_to" IS NULL');

    return db;
}
