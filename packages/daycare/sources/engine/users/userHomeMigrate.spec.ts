import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { configResolve } from "../../config/configResolve.js";
import { storageResolve } from "../../storage/storageResolve.js";
import { storageUpgrade } from "../../storage/storageUpgrade.js";
import { contextForUser } from "../agents/context.js";
import { userHomeMigrate } from "./userHomeMigrate.js";

describe("userHomeMigrate", () => {
    let rootDir: string;

    beforeEach(async () => {
        rootDir = await mkdtemp(path.join(os.tmpdir(), "daycare-user-home-migrate-"));
    });

    afterEach(async () => {
        await rm(rootDir, { recursive: true, force: true });
    });

    it("migrates legacy knowledge into each user's system documents and writes marker", async () => {
        const dataDir = path.join(rootDir, "data");
        const config = configResolve(
            {
                engine: { dataDir }
            },
            path.join(rootDir, "settings.json")
        );
        await storageUpgrade(config);
        const storage = storageResolve(config);
        const owner = await storage.users.create({
            id: "owner-1",
            isOwner: true,
            createdAt: 1,
            updatedAt: 1
        });

        await writeFile(path.join(dataDir, "SOUL.md"), "legacy soul\n", "utf8");
        await writeFile(path.join(dataDir, "USER.md"), "legacy user\n", "utf8");
        await writeFile(path.join(dataDir, "AGENTS.md"), "legacy agents\n", "utf8");
        await writeFile(path.join(dataDir, "TOOLS.md"), "legacy tools\n", "utf8");
        const workspace = await storage.users.create({
            id: "workspace-1",
            isOwner: false,
            isWorkspace: true,
            parentUserId: owner.id,
            createdAt: 2,
            updatedAt: 2
        });
        await mkdir(path.join(config.usersDir, workspace.id, "home", "knowledge"), { recursive: true });
        await writeFile(
            path.join(config.usersDir, workspace.id, "home", "knowledge", "USER.md"),
            "workspace user\n",
            "utf8"
        );
        await writeFile(
            path.join(config.usersDir, workspace.id, "home", "knowledge", "AGENTS.md"),
            "workspace agents\n",
            "utf8"
        );

        await userHomeMigrate(config);

        const users = await storage.users.findMany();
        const migratedOwner = users.find((entry) => entry.isOwner) ?? users[0];
        expect(migratedOwner?.id).toBeTruthy();
        if (!migratedOwner) {
            throw new Error("Owner user missing");
        }
        const ctx = contextForUser({ userId: migratedOwner.id });
        const system = await storage.documents.findBySlugAndParent(ctx, "system", null);
        expect(system?.slug).toBe("system");
        if (!system) {
            throw new Error("System root missing");
        }
        expect((await storage.documents.findBySlugAndParent(ctx, "soul", system.id))?.body).toBe("legacy soul\n");
        expect((await storage.documents.findBySlugAndParent(ctx, "user", system.id))?.body).toBe("legacy user\n");
        expect((await storage.documents.findBySlugAndParent(ctx, "agents", system.id))?.body).toBe("legacy agents\n");
        expect((await storage.documents.findBySlugAndParent(ctx, "tools", system.id))?.body).toBe("legacy tools\n");
        const workspaceCtx = contextForUser({ userId: workspace.id });
        const workspaceSystem = await storage.documents.findBySlugAndParent(workspaceCtx, "system", null);
        if (!workspaceSystem) {
            throw new Error("Workspace system root missing");
        }
        expect((await storage.documents.findBySlugAndParent(workspaceCtx, "user", workspaceSystem.id))?.body).toBe(
            "workspace user\n"
        );
        expect((await storage.documents.findBySlugAndParent(workspaceCtx, "agents", workspaceSystem.id))?.body).toBe(
            "workspace agents\n"
        );
        expect((await storage.documents.findBySlugAndParent(workspaceCtx, "soul", workspaceSystem.id))?.body).not.toBe(
            "legacy soul\n"
        );
        const markerStat = await stat(path.join(config.usersDir, ".migrated"));
        expect(markerStat.isFile()).toBe(true);
    });

    it("is idempotent when marker already exists", async () => {
        const dataDir = path.join(rootDir, "data");
        const config = configResolve(
            {
                engine: { dataDir }
            },
            path.join(rootDir, "settings.json")
        );
        await storageUpgrade(config);
        const storage = storageResolve(config);
        await writeFile(path.join(dataDir, "SOUL.md"), "legacy soul\n", "utf8");

        await userHomeMigrate(config);
        const users = await storage.users.findMany();
        const owner = users.find((entry) => entry.isOwner) ?? users[0];
        if (!owner) {
            throw new Error("Owner user missing");
        }
        const ctx = contextForUser({ userId: owner.id });
        const system = await storage.documents.findBySlugAndParent(ctx, "system", null);
        if (!system) {
            throw new Error("System root missing");
        }
        const soul = await storage.documents.findBySlugAndParent(ctx, "soul", system.id);
        if (!soul) {
            throw new Error("Soul document missing");
        }
        await storage.documents.update(ctx, soul.id, {
            body: "already migrated\n",
            updatedAt: Date.now()
        });

        await userHomeMigrate(config);
        expect((await storage.documents.findBySlugAndParent(ctx, "soul", system.id))?.body).toBe("already migrated\n");
    });

    it("promotes a fallback owner when users table has no owner", async () => {
        const dataDir = path.join(rootDir, "data");
        const config = configResolve(
            {
                engine: { dataDir }
            },
            path.join(rootDir, "settings.json")
        );
        await storageUpgrade(config);
        const storage = storageResolve(config);
        const firstUser = await storage.users.create({
            id: "user-no-owner",
            isOwner: false,
            createdAt: 1,
            updatedAt: 1,
            nametag: "user-no-owner"
        });

        await storage.users.update(firstUser.id, {
            isOwner: false,
            updatedAt: Date.now()
        });

        await userHomeMigrate(config);

        const afterUsers = await storage.users.findMany();
        const owner = afterUsers.find((entry) => entry.isOwner) ?? null;
        expect(owner?.id).toBe(firstUser.id);
    });
});
