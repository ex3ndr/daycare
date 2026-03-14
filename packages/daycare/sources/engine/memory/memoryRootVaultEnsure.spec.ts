import { describe, expect, it } from "vitest";
import { storageOpenTest } from "../../storage/storageOpenTest.js";
import { contextForUser } from "../agents/context.js";
import { memoryRootVaultEnsure } from "./memoryRootVaultEnsure.js";

describe("memoryRootVaultEnsure", () => {
    it("creates vault://memory when missing and is idempotent", async () => {
        const storage = await storageOpenTest();
        try {
            const ctx = contextForUser({ userId: "user-1" });

            const first = await memoryRootVaultEnsure(ctx, storage);
            expect(first.created).toBe(true);

            const created = await storage.documents.findById(ctx, first.id);
            expect(created?.slug).toBe("memory");
            expect(created?.title).toBe("Memory");
            expect(created?.body.length).toBeGreaterThan(0);

            const second = await memoryRootVaultEnsure(ctx, storage);
            expect(second.created).toBe(false);
            expect(second.id).toBe(first.id);
        } finally {
            storage.connection.close();
        }
    });
});
