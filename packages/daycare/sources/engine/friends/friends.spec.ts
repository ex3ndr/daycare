import { describe, expect, it, vi } from "vitest";

import { storageOpenTest } from "../../storage/storageOpenTest.js";
import { contextForAgent } from "../agents/context.js";
import { Friends } from "./friends.js";

describe("Friends", () => {
    it("emits friend request/accept/remove events", async () => {
        const storage = await storageOpenTest();
        try {
            const alice = await storage.users.create({ id: "alice", nametag: "happy-penguin-42" });
            const bob = await storage.users.create({ id: "bob", nametag: "swift-fox-42" });
            const postToUserAgents = vi.fn(async () => undefined);
            const friends = new Friends({ storage, postToUserAgents });

            await friends.add(contextForAgent({ userId: alice.id, agentId: "agent-a" }), { nametag: bob.nametag });
            await friends.add(contextForAgent({ userId: bob.id, agentId: "agent-b" }), { nametag: alice.nametag });
            await friends.remove(contextForAgent({ userId: alice.id, agentId: "agent-a" }), { nametag: bob.nametag });

            const aliceObservations = await storage.observationLog.findMany({ userId: alice.id, agentId: "agent-a" });
            expect(aliceObservations.map((entry) => entry.type)).toEqual(
                expect.arrayContaining(["friend:requested", "friend:removed"])
            );

            const bobObservations = await storage.observationLog.findMany({ userId: bob.id, agentId: "agent-b" });
            expect(bobObservations.map((entry) => entry.type)).toContain("friend:accepted");
            expect(postToUserAgents).toHaveBeenCalled();
        } finally {
            storage.connection.close();
        }
    });
});
