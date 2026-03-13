import { describe, expect, it } from "vitest";
import { storageOpenTest } from "../../storage/storageOpenTest.js";
import { contextForUser } from "../agents/context.js";
import { documentRootDocumentEnsure } from "./documentRootDocumentEnsure.js";

describe("documentRootDocumentEnsure", () => {
    it("creates vault://vault when missing and is idempotent", async () => {
        const storage = await storageOpenTest();
        try {
            const ctx = contextForUser({ userId: "user-1" });

            const first = await documentRootDocumentEnsure(ctx, storage);
            expect(first.created).toBe(true);

            const created = await storage.documents.findById(ctx, first.id);
            expect(created?.slug).toBe("document");
            expect(created?.title).toBe("Vault");
            expect(created?.body.length).toBeGreaterThan(0);

            const second = await documentRootDocumentEnsure(ctx, storage);
            expect(second.created).toBe(false);
            expect(second.id).toBe(first.id);
        } finally {
            storage.connection.close();
        }
    });
});
