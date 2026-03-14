import { describe, expect, it } from "vitest";
import { contextForUser } from "../../engine/agents/context.js";
import { storageOpenTest } from "../../storage/storageOpenTest.js";
import { PsqlService } from "./PsqlService.js";

describe("PsqlService", () => {
    const usersDir = "/tmp/daycare-psql-service-users";

    it("creates, lists, and opens databases", async () => {
        const storage = await storageOpenTest();
        try {
            const service = new PsqlService({
                usersDir,
                databases: storage.psqlDatabases,
                databaseMode: "memory"
            });
            const ctx = contextForUser({ userId: "user-1" });

            const created = await service.createDatabase(ctx, "Main DB");
            expect(created.name).toBe("Main DB");

            const listed = await service.listDatabases(ctx);
            expect(listed).toEqual([
                {
                    id: created.id,
                    userId: "user-1",
                    name: "Main DB",
                    createdAt: created.createdAt
                }
            ]);

            await expect(service.getSchema(ctx, created.id)).resolves.toEqual({ tables: [] });
        } finally {
            await storage.connection.close();
        }
    });

    it("includes psql_schema comment requirements in the system prompt section", async () => {
        const storage = await storageOpenTest();
        try {
            const service = new PsqlService({
                usersDir,
                databases: storage.psqlDatabases,
                databaseMode: "memory"
            });
            const ctx = contextForUser({ userId: "user-1" });

            const emptySection = await service.systemPromptSection(ctx);
            expect(emptySection).toContain("table comment");
            expect(emptySection).toContain("fields[] item comment");

            const database = await service.createDatabase(ctx, "CRM");
            await service.applySchema(ctx, database.id, {
                table: "contacts",
                comment: "Contact records",
                fields: [{ name: "first_name", type: "text", comment: "Given name" }]
            });

            const populatedSection = await service.systemPromptSection(ctx);
            expect(populatedSection).toContain("table comment");
            expect(populatedSection).toContain("fields[] item comment");
            expect(populatedSection).toContain("contacts[first_name:text]");
        } finally {
            await storage.connection.close();
        }
    });

    it("applies schema, mutates data, and runs read-only queries", async () => {
        const storage = await storageOpenTest();
        try {
            const service = new PsqlService({
                usersDir,
                databases: storage.psqlDatabases,
                databaseMode: "memory"
            });
            const ctx = contextForUser({ userId: "user-1" });
            const database = await service.createDatabase(ctx, "CRM");

            const schemaResult = await service.applySchema(ctx, database.id, {
                table: "contacts",
                comment: "Contact records",
                fields: [
                    { name: "first_name", type: "text", comment: "Given name" },
                    { name: "age", type: "integer", comment: "Age in years", nullable: true }
                ]
            });
            expect(schemaResult.errors).toEqual([]);
            expect(schemaResult.changes).toHaveLength(1);

            const added = await service.add(ctx, database.id, "contacts", {
                first_name: "Ada",
                age: 36
            });
            const updated = await service.update(ctx, database.id, "contacts", String(added.id), {
                age: 37
            });
            expect(updated.version).toBe(2);

            const rows = await service.query(
                ctx,
                database.id,
                'SELECT id, version, age FROM "contacts" WHERE "valid_to" IS NULL ORDER BY version ASC'
            );
            expect(rows).toEqual([
                {
                    id: added.id,
                    version: 2,
                    age: 37
                }
            ]);

            const deleted = await service.delete(ctx, database.id, "contacts", String(added.id));
            expect(deleted.valid_to).toEqual(expect.any(Number));

            await expect(
                service.query(ctx, database.id, 'INSERT INTO "contacts" (id) VALUES ($1)', ["x"])
            ).rejects.toThrow("read-only");
        } finally {
            await storage.connection.close();
        }
    });

    it("returns schema errors for destructive diffs", async () => {
        const storage = await storageOpenTest();
        try {
            const service = new PsqlService({
                usersDir,
                databases: storage.psqlDatabases,
                databaseMode: "memory"
            });
            const ctx = contextForUser({ userId: "user-1" });
            const database = await service.createDatabase(ctx, "CRM");

            await service.applySchema(ctx, database.id, {
                table: "contacts",
                comment: "Contact records",
                fields: [{ name: "first_name", type: "text", comment: "Given name" }]
            });

            const second = await service.applySchema(ctx, database.id, {
                table: "contacts",
                comment: "Contact records",
                fields: []
            });
            expect(second.errors).toContain("Column removal is not allowed: contacts.first_name");
        } finally {
            await storage.connection.close();
        }
    });

    it("applies field-level schema diffs for the specified table only", async () => {
        const storage = await storageOpenTest();
        try {
            const service = new PsqlService({
                usersDir,
                databases: storage.psqlDatabases,
                databaseMode: "memory"
            });
            const ctx = contextForUser({ userId: "user-1" });
            const database = await service.createDatabase(ctx, "CRM");

            await service.applySchema(ctx, database.id, {
                table: "contacts",
                comment: "Contact records",
                fields: [{ name: "first_name", type: "text", comment: "Given name" }]
            });
            await service.applySchema(ctx, database.id, {
                table: "companies",
                comment: "Company records",
                fields: [{ name: "name", type: "text", comment: "Company name" }]
            });

            const patch = await service.applySchema(ctx, database.id, {
                table: "contacts",
                comment: "Contact records",
                fields: [
                    { name: "first_name", type: "text", comment: "Given name" },
                    { name: "age", type: "integer", comment: "Age in years", nullable: true }
                ]
            });
            expect(patch.errors).toEqual([]);

            const schema = await service.getSchema(ctx, database.id);
            expect(schema).toEqual({
                tables: [
                    {
                        name: "companies",
                        comment: "Company records",
                        columns: [{ name: "name", type: "text", comment: "Company name", nullable: false }]
                    },
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
        } finally {
            await storage.connection.close();
        }
    });
});
