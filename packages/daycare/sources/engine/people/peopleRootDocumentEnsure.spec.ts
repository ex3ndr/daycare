import { describe, expect, it } from "vitest";
import { storageOpenTest } from "../../storage/storageOpenTest.js";
import { contextForUser } from "../agents/context.js";
import { peopleRootDocumentEnsure } from "./peopleRootDocumentEnsure.js";

describe("peopleRootDocumentEnsure", () => {
    it("creates ~/people when missing and is idempotent", async () => {
        const storage = await storageOpenTest();
        try {
            const ctx = contextForUser({ userId: "user-1" });

            const first = await peopleRootDocumentEnsure(ctx, storage);
            expect(first.created).toBe(true);

            const created = await storage.documents.findById(ctx, first.id);
            expect(created?.slug).toBe("people");
            expect(created?.title).toBe("People");
            expect(created?.body.length).toBeGreaterThan(0);

            const second = await peopleRootDocumentEnsure(ctx, storage);
            expect(second.created).toBe(false);
            expect(second.id).toBe(first.id);
        } finally {
            storage.connection.close();
        }
    });
});
