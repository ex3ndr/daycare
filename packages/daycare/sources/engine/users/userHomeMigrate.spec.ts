import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { configResolve } from "../../config/configResolve.js";
import { storageResolve } from "../../storage/storageResolve.js";
import { storageUpgrade } from "../../storage/storageUpgrade.js";
import { UserHome } from "./userHome.js";
import { userHomeMigrate } from "./userHomeMigrate.js";

describe("userHomeMigrate", () => {
    let rootDir: string;

    beforeEach(async () => {
        rootDir = await mkdtemp(path.join(os.tmpdir(), "daycare-user-home-migrate-"));
    });

    afterEach(async () => {
        await rm(rootDir, { recursive: true, force: true });
    });

    it("copies legacy knowledge into owner user home and writes marker", async () => {
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
        await writeFile(path.join(dataDir, "USER.md"), "legacy user\n", "utf8");
        await writeFile(path.join(dataDir, "AGENTS.md"), "legacy agents\n", "utf8");
        await writeFile(path.join(dataDir, "TOOLS.md"), "legacy tools\n", "utf8");

        await userHomeMigrate(config);

        const users = await storage.users.findMany();
        const owner = users.find((entry) => entry.isOwner) ?? users[0];
        expect(owner?.id).toBeTruthy();
        if (!owner) {
            throw new Error("Owner user missing");
        }
        const ownerHome = new UserHome(config.usersDir, owner.id);
        const knowledge = ownerHome.knowledgePaths();
        expect(await readFile(knowledge.soulPath, "utf8")).toBe("legacy soul\n");
        expect(await readFile(knowledge.userPath, "utf8")).toBe("legacy user\n");
        expect(await readFile(knowledge.agentsPath, "utf8")).toBe("legacy agents\n");
        expect(await readFile(knowledge.toolsPath, "utf8")).toBe("legacy tools\n");
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
        const ownerHome = new UserHome(config.usersDir, owner.id);
        const soulPath = ownerHome.knowledgePaths().soulPath;
        await writeFile(soulPath, "already migrated\n", "utf8");

        await userHomeMigrate(config);
        expect(await readFile(soulPath, "utf8")).toBe("already migrated\n");
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
