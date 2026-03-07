import { describe, expect, it } from "vitest";
import { storageOpenTest } from "../../storage/storageOpenTest.js";
import { contextForUser } from "../agents/context.js";
import { userDocumentsEnsure } from "./userDocumentsEnsure.js";

describe("userDocumentsEnsure", () => {
    it("creates the full base document tree and keeps existing documents intact", async () => {
        const storage = await storageOpenTest();
        try {
            const ctx = contextForUser({ userId: "user-1" });

            await userDocumentsEnsure(ctx, storage, { soulBody: "workspace soul\n" });

            const memory = await storage.documents.findBySlugAndParent(ctx, "memory", null);
            const people = await storage.documents.findBySlugAndParent(ctx, "people", null);
            const document = await storage.documents.findBySlugAndParent(ctx, "document", null);
            const system = await storage.documents.findBySlugAndParent(ctx, "system", null);
            const soul = system ? await storage.documents.findBySlugAndParent(ctx, "soul", system.id) : null;

            expect(memory?.slug).toBe("memory");
            expect(people?.slug).toBe("people");
            expect(document?.slug).toBe("document");
            expect(system?.slug).toBe("system");
            expect(soul?.body).toBe("workspace soul\n");

            await userDocumentsEnsure(ctx, storage, { soulBody: "replacement soul\n" });

            const persistedSoul = system ? await storage.documents.findBySlugAndParent(ctx, "soul", system.id) : null;
            expect(persistedSoul?.body).toBe("workspace soul\n");
        } finally {
            storage.connection.close();
        }
    });
});
