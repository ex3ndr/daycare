import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createId } from "@paralleldrive/cuid2";
import { describe, expect, it } from "vitest";

import { configResolve } from "../config/configResolve.js";
import { storageUpgrade } from "./storageUpgrade.js";
import { userDbConnectorKeyAdd } from "./userDbConnectorKeyAdd.js";
import { userDbDelete } from "./userDbDelete.js";
import { userDbList } from "./userDbList.js";
import { userDbRead } from "./userDbRead.js";
import { userDbReadByConnectorKey } from "./userDbReadByConnectorKey.js";
import { userDbWrite } from "./userDbWrite.js";

describe("userDb", () => {
    it("roundtrips one user with connector keys", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-user-db-"));
        try {
            const config = configResolve(
                { engine: { dataDir: dir }, assistant: { workspaceDir: dir } },
                path.join(dir, "settings.json")
            );
            await storageUpgrade(config);

            const userId = createId();
            await userDbWrite(config, {
                id: userId,
                isOwner: false,
                createdAt: 1,
                updatedAt: 2
            });
            await userDbConnectorKeyAdd(config, userId, "telegram:123");

            const user = await userDbRead(config, userId);
            expect(user).toEqual({
                id: userId,
                isOwner: false,
                createdAt: 1,
                updatedAt: 2,
                connectorKeys: [
                    {
                        id: 1,
                        userId,
                        connectorKey: "telegram:123"
                    }
                ]
            });
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("lists multiple users", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-user-db-"));
        try {
            const config = configResolve(
                { engine: { dataDir: dir }, assistant: { workspaceDir: dir } },
                path.join(dir, "settings.json")
            );
            await storageUpgrade(config);

            const first = createId();
            const second = createId();
            await userDbWrite(config, {
                id: first,
                isOwner: false,
                createdAt: 1,
                updatedAt: 1
            });
            await userDbWrite(config, {
                id: second,
                isOwner: false,
                createdAt: 2,
                updatedAt: 2
            });
            await userDbConnectorKeyAdd(config, first, "telegram:111");
            await userDbConnectorKeyAdd(config, second, "telegram:222");

            const users = await userDbList(config);
            expect(users.length).toBeGreaterThanOrEqual(2);
            expect(users[0]?.id).toBe(first);
            expect(users[1]?.id).toBe(second);
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("reads users by connector key", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-user-db-"));
        try {
            const config = configResolve(
                { engine: { dataDir: dir }, assistant: { workspaceDir: dir } },
                path.join(dir, "settings.json")
            );
            await storageUpgrade(config);

            const userId = createId();
            await userDbWrite(config, {
                id: userId,
                isOwner: false,
                createdAt: 1,
                updatedAt: 1
            });
            await userDbConnectorKeyAdd(config, userId, "telegram:777");

            const user = await userDbReadByConnectorKey(config, "telegram:777");
            expect(user?.id).toBe(userId);
            expect(user?.connectorKeys.map((entry) => entry.connectorKey)).toEqual(["telegram:777"]);
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("rejects duplicate connector keys", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-user-db-"));
        try {
            const config = configResolve(
                { engine: { dataDir: dir }, assistant: { workspaceDir: dir } },
                path.join(dir, "settings.json")
            );
            await storageUpgrade(config);

            const first = createId();
            const second = createId();
            await userDbWrite(config, {
                id: first,
                isOwner: false,
                createdAt: 1,
                updatedAt: 1
            });
            await userDbWrite(config, {
                id: second,
                isOwner: false,
                createdAt: 2,
                updatedAt: 2
            });
            await userDbConnectorKeyAdd(config, first, "telegram:1");

            await expect(userDbConnectorKeyAdd(config, second, "telegram:1")).rejects.toThrow();
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("deletes user and cascades connector keys", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-user-db-"));
        try {
            const config = configResolve(
                { engine: { dataDir: dir }, assistant: { workspaceDir: dir } },
                path.join(dir, "settings.json")
            );
            await storageUpgrade(config);

            const userId = createId();
            await userDbWrite(config, {
                id: userId,
                isOwner: false,
                createdAt: 1,
                updatedAt: 1
            });
            await userDbConnectorKeyAdd(config, userId, "telegram:700");
            await userDbDelete(config, userId);

            const byId = await userDbRead(config, userId);
            const byKey = await userDbReadByConnectorKey(config, "telegram:700");
            expect(byId).toBeNull();
            expect(byKey).toBeNull();
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });
});
