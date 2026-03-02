import { afterEach, describe, expect, it, vi } from "vitest";
import { storageOpenTest } from "./storageOpenTest.js";
import { UsersRepository } from "./usersRepository.js";

describe("UsersRepository", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("supports CRUD and connector key operations", async () => {
        const storage = await storageOpenTest();
        try {
            const users = new UsersRepository(storage.db);
            const created = await users.create({
                isOwner: false,
                createdAt: 1,
                updatedAt: 2,
                firstName: "Steve",
                lastName: "Jobs",
                country: "US",
                timezone: "America/Los_Angeles",
                nametag: "swift-fox-42",
                connectorKey: "telegram:1"
            });
            expect(created.isOwner).toBe(false);
            expect(created.connectorKeys.map((entry) => entry.connectorKey)).toEqual(["telegram:1"]);
            expect(created.nametag).toBe("swift-fox-42");
            expect(created.firstName).toBe("Steve");
            expect(created.lastName).toBe("Jobs");
            expect(created.country).toBe("US");
            expect(created.timezone).toBe("America/Los_Angeles");

            const byId = await users.findById(created.id);
            expect(byId?.id).toBe(created.id);

            const byKey = await users.findByConnectorKey("telegram:1");
            expect(byKey?.id).toBe(created.id);
            const byNametag = await users.findByNametag("swift-fox-42");
            expect(byNametag?.id).toBe(created.id);

            await users.addConnectorKey(created.id, "slack:1");
            const updated = await users.findById(created.id);
            expect(updated?.connectorKeys.map((entry) => entry.connectorKey)).toEqual(["telegram:1", "slack:1"]);

            vi.spyOn(Date, "now").mockReturnValue(3);
            await users.update(created.id, {
                isOwner: false,
                firstName: "Steven",
                lastName: null,
                country: "USA",
                timezone: "America/New_York",
                updatedAt: 3
            });
            const updatedOwner = await users.findById(created.id);
            expect(updatedOwner?.isOwner).toBe(false);
            expect(updatedOwner?.updatedAt).toBe(3);
            expect(updatedOwner?.firstName).toBe("Steven");
            expect(updatedOwner?.lastName).toBeNull();
            expect(updatedOwner?.country).toBe("USA");
            expect(updatedOwner?.timezone).toBe("America/New_York");

            const owner = await users.findOwner();
            expect(owner).toBeTruthy();
            expect(owner?.id).not.toBe(created.id);

            await users.delete(created.id);
            expect(await users.findById(created.id)).toBeNull();
            expect(await users.findByConnectorKey("telegram:1")).toBeNull();
            expect(await users.findByNametag("swift-fox-42")).toBeNull();
        } finally {
            storage.connection.close();
        }
    });

    it("returns cached user on repeated read", async () => {
        const storage = await storageOpenTest();
        try {
            const users = new UsersRepository(storage.db);
            const created = await users.create({ createdAt: 1, updatedAt: 1 });

            const first = await users.findById(created.id);
            expect(first?.id).toBe(created.id);

            storage.connection.prepare("DELETE FROM users WHERE id = ?").run(created.id);
            const second = await users.findById(created.id);
            expect(second?.id).toBe(created.id);
        } finally {
            storage.connection.close();
        }
    });

    it("loads from db on cache miss and invalidates after delete", async () => {
        const storage = await storageOpenTest();
        try {
            const users = new UsersRepository(storage.db);
            storage.connection
                .prepare(
                    "INSERT INTO users (id, version, valid_from, valid_to, is_owner, nametag, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
                )
                .run("user-1", 1, 10, null, false, "brave-wolf-99", 10, 11);
            storage.connection
                .prepare("INSERT INTO user_connector_keys (user_id, connector_key) VALUES (?, ?)")
                .run("user-1", "telegram:1");

            const loaded = await users.findById("user-1");
            expect(loaded?.id).toBe("user-1");
            expect(loaded?.connectorKeys.map((entry) => entry.connectorKey)).toEqual(["telegram:1"]);
            expect((await users.findByNametag("brave-wolf-99"))?.id).toBe("user-1");

            await users.delete("user-1");
            expect(await users.findById("user-1")).toBeNull();
            expect(await users.findByConnectorKey("telegram:1")).toBeNull();
            expect(await users.findByNametag("brave-wolf-99")).toBeNull();
        } finally {
            storage.connection.close();
        }
    });

    it("keeps current user row when version advance insert fails", async () => {
        const storage = await storageOpenTest();
        try {
            const users = new UsersRepository(storage.db);
            const owner = await users.findOwner();
            const second = await users.create({
                isOwner: false,
                createdAt: 2,
                updatedAt: 2,
                nametag: "owner-2"
            });

            expect(owner?.isOwner).toBe(true);
            await expect(
                users.update(second.id, {
                    isOwner: true,
                    updatedAt: 3
                })
            ).rejects.toThrow();

            const persisted = await users.findById(second.id);
            expect(persisted?.id).toBe(second.id);
            expect(persisted?.isOwner).toBe(false);

            const rows = (await storage.connection
                .prepare("SELECT id FROM users WHERE id = ? AND valid_to IS NULL")
                .all(second.id)) as Array<{ id: string }>;
            expect(rows).toHaveLength(1);
        } finally {
            storage.connection.close();
        }
    });
});
