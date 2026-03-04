import { describe, expect, it } from "vitest";
import { contextForUser } from "../engine/agents/context.js";
import { storageOpenTest } from "./storageOpenTest.js";

describe("PsqlDatabasesRepository", () => {
    it("creates and lists per-user database metadata", async () => {
        const storage = await storageOpenTest();

        try {
            const ctxA = contextForUser({ userId: "user-a" });
            const ctxB = contextForUser({ userId: "user-b" });

            await storage.psqlDatabases.create(ctxA, {
                id: "db-1",
                name: "Primary",
                createdAt: 1
            });
            await storage.psqlDatabases.create(ctxA, {
                id: "db-2",
                name: "Secondary",
                createdAt: 2
            });
            await storage.psqlDatabases.create(ctxB, {
                id: "db-3",
                name: "Other",
                createdAt: 3
            });

            const listedA = await storage.psqlDatabases.findMany(ctxA);
            expect(listedA).toEqual([
                { userId: "user-a", id: "db-1", name: "Primary", createdAt: 1 },
                { userId: "user-a", id: "db-2", name: "Secondary", createdAt: 2 }
            ]);

            const listedB = await storage.psqlDatabases.findMany(ctxB);
            expect(listedB).toEqual([{ userId: "user-b", id: "db-3", name: "Other", createdAt: 3 }]);

            await expect(storage.psqlDatabases.findById(ctxA, "db-2")).resolves.toEqual({
                userId: "user-a",
                id: "db-2",
                name: "Secondary",
                createdAt: 2
            });
            await expect(storage.psqlDatabases.findById(ctxA, "db-3")).resolves.toBeNull();
        } finally {
            await storage.connection.close();
        }
    });
});
