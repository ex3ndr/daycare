import { describe, expect, it } from "vitest";
import { Storage } from "./storage.js";

describe("ConnectionsRepository", () => {
    it("upserts requests with canonical pair ordering", async () => {
        const storage = Storage.open(":memory:");
        try {
            const alice = await storage.users.create({ id: "alice", usertag: "alice-tag-42" });
            const bob = await storage.users.create({ id: "bob", usertag: "bob-tag-42" });

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
            storage.close();
        }
    });

    it("clears the selected side and preserves timestamps for cooldown checks", async () => {
        const storage = Storage.open(":memory:");
        try {
            await storage.users.create({ id: "alice", usertag: "alice-tag-42" });
            await storage.users.create({ id: "bob", usertag: "bob-tag-42" });

            await storage.connections.upsertRequest("alice", "bob", 100);
            await storage.connections.upsertRequest("bob", "alice", 200);

            const cleared = await storage.connections.clearSide("alice", "bob");
            expect(cleared?.requestedA).toBe(false);
            expect(cleared?.requestedB).toBe(true);
            expect(cleared?.requestedAAt).toBe(100);
            expect(cleared?.requestedBAt).toBe(200);
        } finally {
            storage.close();
        }
    });

    it("finds friendships scoped to a user and deletes connection rows", async () => {
        const storage = Storage.open(":memory:");
        try {
            await storage.users.create({ id: "alice", usertag: "alice-tag-42" });
            await storage.users.create({ id: "bob", usertag: "bob-tag-42" });
            await storage.users.create({ id: "charlie", usertag: "charlie-tag-42" });

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
            storage.close();
        }
    });
});
