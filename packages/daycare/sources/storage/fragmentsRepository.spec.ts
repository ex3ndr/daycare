import { afterEach, describe, expect, it, vi } from "vitest";
import { contextForAgent } from "../engine/agents/context.js";
import { FragmentsRepository } from "./fragmentsRepository.js";
import { storageOpenTest } from "./storageOpenTest.js";

describe("FragmentsRepository", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("creates fragments and rejects duplicate ids", async () => {
        const storage = await storageOpenTest();
        try {
            const repo = new FragmentsRepository(storage.db);
            const ctx = contextForAgent({ userId: "user-1", agentId: "agent-1" });

            const created = await repo.create(ctx, {
                id: "fragment-1",
                kitVersion: "1",
                title: "Profile Card",
                description: "Shows profile summary",
                spec: { type: "Column", children: [] },
                createdAt: 1,
                updatedAt: 1
            });
            expect(created).toEqual({
                id: "fragment-1",
                userId: "user-1",
                version: 1,
                validFrom: 1,
                validTo: null,
                kitVersion: "1",
                title: "Profile Card",
                description: "Shows profile summary",
                spec: { type: "Column", children: [] },
                archived: false,
                createdAt: 1,
                updatedAt: 1
            });

            await expect(
                repo.create(ctx, {
                    id: "fragment-1",
                    kitVersion: "1",
                    title: "Duplicate",
                    description: "",
                    spec: { type: "Text", text: "duplicate" },
                    createdAt: 2,
                    updatedAt: 2
                })
            ).rejects.toThrow("Fragment id already exists");
        } finally {
            storage.connection.close();
        }
    });

    it("updates fragments with version advance and errors when not found", async () => {
        const storage = await storageOpenTest();
        try {
            const repo = new FragmentsRepository(storage.db);
            const ctx = contextForAgent({ userId: "user-1", agentId: "agent-1" });
            await repo.create(ctx, {
                id: "fragment-1",
                kitVersion: "1",
                title: "Profile Card",
                description: "Shows profile summary",
                spec: { type: "Column", children: [] },
                createdAt: 1,
                updatedAt: 1
            });

            const updated = await repo.update(ctx, "fragment-1", {
                title: "Profile Card V2",
                description: "Updated summary",
                spec: { type: "Column", children: [{ type: "Text", text: "hello" }] },
                updatedAt: 2
            });
            expect(updated).toEqual({
                id: "fragment-1",
                userId: "user-1",
                version: 2,
                validFrom: 2,
                validTo: null,
                kitVersion: "1",
                title: "Profile Card V2",
                description: "Updated summary",
                spec: { type: "Column", children: [{ type: "Text", text: "hello" }] },
                archived: false,
                createdAt: 1,
                updatedAt: 2
            });

            const versions = (await storage.connection
                .prepare("SELECT version, valid_to FROM fragments WHERE user_id = ? AND id = ? ORDER BY version ASC")
                .all(ctx.userId, "fragment-1")) as Array<{ version: number; valid_to: number | null }>;
            expect(versions).toEqual([
                { version: 1, valid_to: expect.any(Number) },
                { version: 2, valid_to: null }
            ]);

            await expect(repo.update(ctx, "missing", { title: "Nope" })).rejects.toThrow("Fragment not found");
        } finally {
            storage.connection.close();
        }
    });

    it("archives fragments and keeps latest archived row discoverable by findAnyById", async () => {
        const storage = await storageOpenTest();
        try {
            const repo = new FragmentsRepository(storage.db);
            const ctx = contextForAgent({ userId: "user-1", agentId: "agent-1" });
            await repo.create(ctx, {
                id: "fragment-1",
                kitVersion: "1",
                title: "Profile Card",
                description: "Shows profile summary",
                spec: { type: "Column", children: [] },
                createdAt: 1,
                updatedAt: 1
            });

            vi.spyOn(Date, "now").mockReturnValue(3);
            const archived = await repo.archive(ctx, "fragment-1");
            expect(archived.archived).toBe(true);
            expect(archived.version).toBe(2);
            expect(archived.validFrom).toBe(3);

            const active = await repo.findById(ctx, "fragment-1");
            expect(active).toBeNull();

            const any = await repo.findAnyById(ctx, "fragment-1");
            expect(any?.id).toBe("fragment-1");
            expect(any?.archived).toBe(true);
            expect(any?.version).toBe(2);

            await expect(repo.archive(ctx, "missing")).rejects.toThrow("Fragment not found");
        } finally {
            storage.connection.close();
        }
    });

    it("findById returns active row and findAll excludes archived", async () => {
        const storage = await storageOpenTest();
        try {
            const repo = new FragmentsRepository(storage.db);
            const ctx = contextForAgent({ userId: "user-1", agentId: "agent-1" });
            await repo.create(ctx, {
                id: "visible",
                kitVersion: "1",
                title: "Visible",
                description: "Visible fragment",
                spec: { type: "Text", text: "visible" },
                createdAt: 1,
                updatedAt: 1
            });
            await repo.create(ctx, {
                id: "hidden",
                kitVersion: "1",
                title: "Hidden",
                description: "Hidden fragment",
                spec: { type: "Text", text: "hidden" },
                createdAt: 2,
                updatedAt: 2
            });
            vi.spyOn(Date, "now").mockReturnValue(3);
            await repo.archive(ctx, "hidden");

            const visible = await repo.findById(ctx, "visible");
            const hidden = await repo.findById(ctx, "hidden");
            expect(visible?.title).toBe("Visible");
            expect(hidden).toBeNull();

            const all = await repo.findAll(ctx);
            expect(all.map((entry) => entry.id)).toEqual(["visible"]);
        } finally {
            storage.connection.close();
        }
    });

    it("unarchives fragments and makes them discoverable by findById again", async () => {
        const storage = await storageOpenTest();
        try {
            const repo = new FragmentsRepository(storage.db);
            const ctx = contextForAgent({ userId: "user-1", agentId: "agent-1" });
            await repo.create(ctx, {
                id: "fragment-1",
                kitVersion: "1",
                title: "Profile Card",
                description: "Shows profile summary",
                spec: { type: "Column", children: [] },
                createdAt: 1,
                updatedAt: 1
            });

            vi.spyOn(Date, "now").mockReturnValue(3);
            await repo.archive(ctx, "fragment-1");
            const archived = await repo.findById(ctx, "fragment-1");
            expect(archived).toBeNull();

            vi.spyOn(Date, "now").mockReturnValue(5);
            const restored = await repo.unarchive(ctx, "fragment-1");
            expect(restored.archived).toBe(false);
            expect(restored.version).toBe(3);
            expect(restored.validFrom).toBe(5);

            const active = await repo.findById(ctx, "fragment-1");
            expect(active?.id).toBe("fragment-1");
            expect(active?.archived).toBe(false);

            await expect(repo.unarchive(ctx, "missing")).rejects.toThrow("Fragment not found");
            await expect(repo.unarchive(ctx, "fragment-1")).rejects.toThrow("Fragment is not archived");
        } finally {
            storage.connection.close();
        }
    });
});