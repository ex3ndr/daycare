import { describe, expect, it } from "vitest";
import { type Context, contextForAgent } from "../engine/agents/context.js";
import { KeyValuesRepository } from "./keyValuesRepository.js";
import { storageOpenTest } from "./storageOpenTest.js";

describe("KeyValuesRepository", () => {
    it("creates, reads, updates, and deletes values per user", async () => {
        const storage = await storageOpenTest();
        try {
            const repository = new KeyValuesRepository(storage.db);
            const userA = ctxBuild("user-a");
            const userB = ctxBuild("user-b");

            const created = await repository.create(userA, {
                key: "settings",
                value: {
                    theme: "dark",
                    flags: ["a", "b"]
                },
                createdAt: 10,
                updatedAt: 10
            });

            expect(created).toEqual({
                userId: "user-a",
                key: "settings",
                version: 1,
                validFrom: 10,
                validTo: null,
                value: { theme: "dark", flags: ["a", "b"] },
                createdAt: 10,
                updatedAt: 10
            });

            const read = await repository.findByKey(userA, "settings");
            expect(read?.value).toEqual({ theme: "dark", flags: ["a", "b"] });
            expect(await repository.findByKey(userB, "settings")).toBeNull();

            const updated = await repository.update(userA, "settings", { theme: "light" }, 25);
            expect(updated).toEqual({
                userId: "user-a",
                key: "settings",
                version: 2,
                validFrom: 25,
                validTo: null,
                value: { theme: "light" },
                createdAt: 10,
                updatedAt: 25
            });

            const userAEntries = await repository.findMany(userA);
            expect(userAEntries).toHaveLength(1);
            expect(userAEntries[0]?.value).toEqual({ theme: "light" });

            const deleted = await repository.delete(userA, "settings");
            expect(deleted).toBe(true);
            expect(await repository.findByKey(userA, "settings")).toBeNull();

            const rows = (await storage.connection
                .prepare("SELECT version, valid_to FROM key_values WHERE user_id = ? AND key = ? ORDER BY version ASC")
                .all("user-a", "settings")) as Array<{ version: number; valid_to: number | null }>;
            expect(rows).toHaveLength(2);
            expect(rows[0]?.valid_to).toBe(25);
            expect(rows[1]?.valid_to).not.toBeNull();
        } finally {
            storage.connection.close();
        }
    });

    it("rejects duplicate create and supports null values", async () => {
        const storage = await storageOpenTest();
        try {
            const repository = new KeyValuesRepository(storage.db);
            const ctx = ctxBuild("user-a");

            await repository.create(ctx, { key: "empty", value: null, createdAt: 1, updatedAt: 1 });
            await expect(repository.create(ctx, { key: "empty", value: "x" })).rejects.toThrow(
                "Key already exists: empty"
            );
        } finally {
            storage.connection.close();
        }
    });
});

function ctxBuild(userId: string): Context {
    return contextForAgent({ userId, agentId: "test-agent" });
}
