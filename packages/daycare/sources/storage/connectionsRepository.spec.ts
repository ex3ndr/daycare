import { describe, expect, it } from "vitest";
import { storageOpenTest } from "./storageOpenTest.js";

describe("ConnectionsRepository", () => {
    it("upserts requests with canonical pair ordering", async () => {
        const storage = await storageOpenTest();
        try {
            const alice = await storage.users.create({ id: "alice", nametag: "alice-tag-42" });
            const bob = await storage.users.create({ id: "bob", nametag: "bob-tag-42" });

            const created = await storage.connections.upsertRequest(alice.id, bob.id, 100);
            expect(created.userAId).toBe("alice");
            expect(created.userBId).toBe("bob");
            expect(created.requestedA).toBe(true);
            expect(created.requestedB).toBe(false);
            expect(created.requestedAAt).toBe(100);
            expect(created.requestedBAt).toBeNull();

            const confirmed = await storage.connections.upsertRequest(bob.id, alice.id, 200);
            expect(confirmed.requestedA).toBe(true);
            expect(confirmed.requestedB).toBe(true);
            expect(confirmed.requestedAAt).toBe(100);
            expect(confirmed.requestedBAt).toBe(200);
        } finally {
            storage.db.close();
        }
    });

    it("clears the selected side and preserves timestamps for cooldown checks", async () => {
        const storage = await storageOpenTest();
        try {
            await storage.users.create({ id: "alice", nametag: "alice-tag-42" });
            await storage.users.create({ id: "bob", nametag: "bob-tag-42" });

            await storage.connections.upsertRequest("alice", "bob", 100);
            await storage.connections.upsertRequest("bob", "alice", 200);

            const cleared = await storage.connections.clearSide("alice", "bob");
            expect(cleared?.requestedA).toBe(false);
            expect(cleared?.requestedB).toBe(true);
            expect(cleared?.requestedAAt).toBe(100);
            expect(cleared?.requestedBAt).toBe(200);
        } finally {
            storage.db.close();
        }
    });

    it("finds friendships scoped to a user and deletes connection rows", async () => {
        const storage = await storageOpenTest();
        try {
            await storage.users.create({ id: "alice", nametag: "alice-tag-42" });
            await storage.users.create({ id: "bob", nametag: "bob-tag-42" });
            await storage.users.create({ id: "charlie", nametag: "charlie-tag-42" });

            await storage.connections.upsertRequest("alice", "bob", 100);
            await storage.connections.upsertRequest("bob", "alice", 200);
            await storage.connections.upsertRequest("charlie", "alice", 300);

            const aliceFriends = await storage.connections.findFriends("alice");
            expect(aliceFriends).toHaveLength(1);
            expect(aliceFriends[0]?.userAId).toBe("alice");
            expect(aliceFriends[0]?.userBId).toBe("bob");

            const removed = await storage.connections.delete("bob", "alice");
            expect(removed).toBe(true);
            expect(await storage.connections.find("alice", "bob")).toBeNull();
        } finally {
            storage.db.close();
        }
    });

    it("finds all connections that involve subusers of an owner", async () => {
        const storage = await storageOpenTest();
        try {
            await storage.users.create({ id: "alice", nametag: "alice-tag-42" });
            await storage.users.create({ id: "bob", nametag: "bob-tag-42" });
            await storage.users.create({ id: "charlie", nametag: "charlie-tag-42" });
            await storage.users.create({ id: "alice-sub-1", parentUserId: "alice", nametag: "alice-sub-1-tag-42" });
            await storage.users.create({ id: "alice-sub-2", parentUserId: "alice", nametag: "alice-sub-2-tag-42" });
            await storage.users.create({ id: "bob-sub-1", parentUserId: "bob", nametag: "bob-sub-1-tag-42" });

            await storage.connections.upsertRequest("alice-sub-1", "bob", 100);
            await storage.connections.upsertRequest("alice-sub-2", "bob", 200);
            await storage.connections.upsertRequest("charlie", "alice-sub-1", 300);
            await storage.connections.upsertRequest("alice", "bob-sub-1", 400);

            const aliceSubuserConnections = await storage.connections.findConnectionsForSubusersOf("alice");
            expect(aliceSubuserConnections).toHaveLength(3);
            expect(aliceSubuserConnections.map((row) => `${row.userAId}:${row.userBId}`)).toEqual([
                "alice-sub-1:bob",
                "alice-sub-1:charlie",
                "alice-sub-2:bob"
            ]);
        } finally {
            storage.db.close();
        }
    });

    it("finds connections between a friend and another owner's subusers", async () => {
        const storage = await storageOpenTest();
        try {
            await storage.users.create({ id: "alice", nametag: "alice-tag-42" });
            await storage.users.create({ id: "bob", nametag: "bob-tag-42" });
            await storage.users.create({ id: "charlie", nametag: "charlie-tag-42" });
            await storage.users.create({ id: "alice-sub-1", parentUserId: "alice", nametag: "alice-sub-1-tag-42" });
            await storage.users.create({ id: "alice-sub-2", parentUserId: "alice", nametag: "alice-sub-2-tag-42" });
            await storage.users.create({
                id: "charlie-sub-1",
                parentUserId: "charlie",
                nametag: "charlie-sub-1-tag-42"
            });

            await storage.connections.upsertRequest("alice-sub-1", "bob", 100);
            await storage.connections.upsertRequest("alice-sub-2", "bob", 200);
            await storage.connections.upsertRequest("alice-sub-1", "charlie", 300);
            await storage.connections.upsertRequest("bob", "charlie-sub-1", 400);

            const rows = await storage.connections.findConnectionsWithSubusersOf("bob", "alice");
            expect(rows).toHaveLength(2);
            expect(rows.map((row) => `${row.userAId}:${row.userBId}`)).toEqual(["alice-sub-1:bob", "alice-sub-2:bob"]);
        } finally {
            storage.db.close();
        }
    });
});
