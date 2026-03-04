import { describe, expect, it } from "vitest";

import { ModelRoleRulesRepository } from "./modelRoleRulesRepository.js";
import { storageOpenTest } from "./storageOpenTest.js";

describe("ModelRoleRulesRepository", () => {
    it("supports insert, findAll, findById, update, and delete", async () => {
        const storage = await storageOpenTest();
        try {
            const repo = new ModelRoleRulesRepository(storage.db);

            // Insert
            const r1 = await repo.insert({ role: "user", model: "anthropic/opus" });
            expect(r1.id).toBeTruthy();
            expect(r1.role).toBe("user");
            expect(r1.kind).toBeNull();
            expect(r1.model).toBe("anthropic/opus");

            const r2 = await repo.insert({ kind: "connector", userId: "u1", model: "openai/gpt-4" });

            // findAll
            const all = await repo.findAll();
            expect(all).toHaveLength(2);

            // findById
            const found = await repo.findById(r1.id);
            expect(found).not.toBeNull();
            expect(found!.model).toBe("anthropic/opus");

            expect(await repo.findById("nonexistent")).toBeNull();

            // Update
            const updated = await repo.update(r1.id, { model: "anthropic/sonnet" });
            expect(updated).not.toBeNull();
            expect(updated!.model).toBe("anthropic/sonnet");
            expect(updated!.role).toBe("user");

            expect(await repo.update("nonexistent", { model: "x" })).toBeNull();

            // Delete
            expect(await repo.delete(r2.id)).toBe(true);
            expect(await repo.delete(r2.id)).toBe(false);

            const remaining = await repo.findAll();
            expect(remaining).toHaveLength(1);
            expect(remaining[0]!.id).toBe(r1.id);
        } finally {
            await storage.connection.close();
        }
    });
});
