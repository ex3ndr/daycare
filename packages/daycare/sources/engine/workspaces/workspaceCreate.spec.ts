import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { storageOpenTest } from "../../storage/storageOpenTest.js";
import { contextForUser } from "../agents/context.js";
import { UserHome } from "../users/userHome.js";
import { workspaceCreate } from "./workspaceCreate.js";

describe("workspaceCreate", () => {
    it("creates a workspace user and full base document tree", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-workspace-create-"));
        const storage = await storageOpenTest();
        try {
            const owner = await storage.users.findOwner();
            if (!owner) {
                throw new Error("Owner user not found.");
            }

            const created = await workspaceCreate({
                ownerUserId: owner.id,
                config: {
                    firstName: "Todo",
                    lastName: "Workspace",
                    bio: "Manages todos",
                    about: "Autonomous todo management",
                    systemPrompt: "You are the todo workspace.",
                    emoji: "📝",
                    memory: false
                },
                storage,
                userHomeForUserId: (userId) => new UserHome(path.join(dir, "users"), userId)
            });

            const user = await storage.users.findById(created.userId);
            const ctx = contextForUser({ userId: created.userId });
            const memory = await storage.documents.findBySlugAndParent(ctx, "memory", null);
            const people = await storage.documents.findBySlugAndParent(ctx, "people", null);
            const document = await storage.documents.findBySlugAndParent(ctx, "document", null);
            const system = await storage.documents.findBySlugAndParent(ctx, "system", null);
            const soul = system ? await storage.documents.findBySlugAndParent(ctx, "soul", system.id) : null;

            expect(user?.parentUserId).toBe(owner.id);
            expect(user?.isWorkspace).toBe(true);
            expect(typeof user?.nametag).toBe("string");
            expect(user?.nametag?.length).toBeGreaterThan(0);
            expect(user?.firstName).toBe("Todo");
            expect(user?.lastName).toBe("Workspace");
            expect(user?.bio).toBe("Manages todos");
            expect(user?.about).toBe("Autonomous todo management");
            expect(user?.memory).toBe(false);
            expect(user?.emoji).toBe("📝");
            expect(memory?.slug).toBe("memory");
            expect(people?.slug).toBe("people");
            expect(document?.slug).toBe("document");
            expect(soul?.body).toContain("You are the todo workspace.");
        } finally {
            storage.connection.close();
            await rm(dir, { recursive: true, force: true });
        }
    });
});
