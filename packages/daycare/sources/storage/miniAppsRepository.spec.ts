import { describe, expect, it } from "vitest";
import { contextForUser } from "../engine/agents/context.js";
import { storageOpenTest } from "./storageOpenTest.js";

describe("MiniAppsRepository", () => {
    it("creates, updates, lists, and deletes mini apps per user", async () => {
        const storage = await storageOpenTest();
        try {
            const ctxA = contextForUser({ userId: "user-a" });
            const ctxB = contextForUser({ userId: "user-b" });

            await storage.miniApps.create(ctxA, {
                id: "crm",
                title: "CRM",
                icon: "browser",
                codeVersion: 1,
                createdAt: 1,
                updatedAt: 1
            });
            await storage.miniApps.create(ctxB, {
                id: "other",
                title: "Other",
                icon: "home",
                codeVersion: 1,
                createdAt: 2,
                updatedAt: 2
            });

            const updated = await storage.miniApps.update(ctxA, "crm", {
                title: "CRM Board",
                codeVersion: 1,
                updatedAt: 3
            });
            expect(updated).toEqual({
                userId: "user-a",
                id: "crm",
                version: 2,
                codeVersion: 1,
                validFrom: 3,
                validTo: null,
                title: "CRM Board",
                icon: "browser",
                createdAt: 1,
                updatedAt: 3
            });

            await expect(storage.miniApps.findAll(ctxA)).resolves.toEqual([updated]);
            await expect(storage.miniApps.findAll(ctxB)).resolves.toEqual([
                {
                    userId: "user-b",
                    id: "other",
                    version: 1,
                    codeVersion: 1,
                    validFrom: 2,
                    validTo: null,
                    title: "Other",
                    icon: "home",
                    createdAt: 2,
                    updatedAt: 2
                }
            ]);

            await expect(storage.miniApps.findAnyById(ctxA, "crm")).resolves.toEqual(updated);
            await expect(storage.miniApps.findByVersion(ctxA, "crm", 1)).resolves.toEqual({
                userId: "user-a",
                id: "crm",
                version: 1,
                codeVersion: 1,
                validFrom: 1,
                validTo: 3,
                title: "CRM",
                icon: "browser",
                createdAt: 1,
                updatedAt: 1
            });
            await expect(storage.miniApps.findById(ctxA, "other")).resolves.toBeNull();

            await expect(storage.miniApps.delete(ctxA, "crm")).resolves.toEqual(updated);
            await expect(storage.miniApps.findById(ctxA, "crm")).resolves.toBeNull();
        } finally {
            await storage.connection.close();
        }
    });

    it("restores deleted mini apps", async () => {
        const storage = await storageOpenTest();
        try {
            const ctxA = contextForUser({ userId: "user-a" });

            const created = await storage.miniApps.create(ctxA, {
                id: "restorable",
                title: "Restorable App",
                icon: "browser",
                codeVersion: 1,
                createdAt: 1,
                updatedAt: 1
            });
            expect(created.version).toBe(1);

            await storage.miniApps.delete(ctxA, "restorable");
            await expect(storage.miniApps.findById(ctxA, "restorable")).resolves.toBeNull();

            const restored = await storage.miniApps.restore(ctxA, "restorable");
            expect(restored.validTo).toBeNull();
            expect(restored.title).toBe("Restorable App");

            const found = await storage.miniApps.findById(ctxA, "restorable");
            expect(found).not.toBeNull();
            expect(found?.id).toBe("restorable");

            await expect(storage.miniApps.restore(ctxA, "restorable")).rejects.toThrow("not deleted");
            await expect(storage.miniApps.restore(ctxA, "nonexistent")).rejects.toThrow("not found");
        } finally {
            await storage.connection.close();
        }
    });
});