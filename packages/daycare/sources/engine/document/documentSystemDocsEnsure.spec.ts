import { describe, expect, it } from "vitest";
import { storageOpenTest } from "../../storage/storageOpenTest.js";
import { contextForUser } from "../agents/context.js";
import { agentPromptBundledRead } from "../agents/ops/agentPromptBundledRead.js";
import { documentSystemDocsEnsure } from "./documentSystemDocsEnsure.js";

describe("documentSystemDocsEnsure", () => {
    it("creates doc://system with bundled child prompt documents", async () => {
        const storage = await storageOpenTest();
        try {
            const ctx = contextForUser({ userId: "user-1" });

            const first = await documentSystemDocsEnsure(ctx, storage);
            expect(first.created).toBe(true);

            const root = await storage.documents.findById(ctx, first.id);
            expect(root?.slug).toBe("system");
            expect(root?.title).toBe("System");

            const soul = await storage.documents.findBySlugAndParent(ctx, "soul", first.id);
            const user = await storage.documents.findBySlugAndParent(ctx, "user", first.id);
            const agents = await storage.documents.findBySlugAndParent(ctx, "agents", first.id);
            const tools = await storage.documents.findBySlugAndParent(ctx, "tools", first.id);

            expect(soul?.body).toBe(await agentPromptBundledRead("SOUL.md"));
            expect(user?.body).toBe(await agentPromptBundledRead("USER.md"));
            expect(agents?.body).toBe(await agentPromptBundledRead("AGENTS.md"));
            expect(tools?.body).toBe(await agentPromptBundledRead("TOOLS.md"));
        } finally {
            storage.connection.close();
        }
    });

    it("is idempotent and keeps existing child documents", async () => {
        const storage = await storageOpenTest();
        try {
            const ctx = contextForUser({ userId: "user-1" });

            const first = await documentSystemDocsEnsure(ctx, storage, { soulBody: "initial soul\n" });
            const system = await storage.documents.findById(ctx, first.id);
            if (!system) {
                throw new Error("Missing system root document.");
            }
            const soul = await storage.documents.findBySlugAndParent(ctx, "soul", system.id);
            if (!soul) {
                throw new Error("Missing soul system document.");
            }

            const second = await documentSystemDocsEnsure(ctx, storage, { soulBody: "replacement soul\n" });
            expect(second.created).toBe(false);
            expect(second.id).toBe(first.id);

            const persistedSoul = await storage.documents.findBySlugAndParent(ctx, "soul", system.id);
            expect(persistedSoul?.body).toBe("initial soul\n");
        } finally {
            storage.connection.close();
        }
    });
});
