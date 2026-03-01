import { describe, expect, it, vi } from "vitest";
import { storageOpenTest } from "../../storage/storageOpenTest.js";
import { contextForAgent } from "../agents/context.js";
import { Friends } from "./friends.js";

describe("Friends", () => {
    it("emits friend request/accept/remove and subuser share events", async () => {
        const storage = await storageOpenTest();
        try {
            const alice = await storage.users.create({ id: "alice", nametag: "happy-penguin-42" });
            const bob = await storage.users.create({ id: "bob", nametag: "swift-fox-42" });
            const subuser = await storage.users.create({
                id: "alice-sub-1",
                parentUserId: alice.id,
                name: "helper",
                nametag: "cool-cat-11"
            });
            const postToUserAgents = vi.fn(async () => undefined);
            const friends = new Friends({ storage, postToUserAgents });

            await friends.add(contextForAgent({ userId: alice.id, agentId: "agent-a" }), { nametag: bob.nametag });
            await friends.add(contextForAgent({ userId: bob.id, agentId: "agent-b" }), { nametag: alice.nametag });
            await friends.shareSubuser(contextForAgent({ userId: alice.id, agentId: "agent-a" }), {
                friendNametag: bob.nametag,
                subuserId: subuser.id
            });
            await friends.unshareSubuser(contextForAgent({ userId: alice.id, agentId: "agent-a" }), {
                friendNametag: bob.nametag,
                subuserId: subuser.id
            });
            await friends.remove(contextForAgent({ userId: alice.id, agentId: "agent-a" }), { nametag: bob.nametag });

            const aliceObservations = await storage.observationLog.findMany({ userId: alice.id, agentId: "agent-a" });
            expect(aliceObservations.map((entry) => entry.type)).toEqual(
                expect.arrayContaining([
                    "friend:requested",
                    "friend:subuser_shared",
                    "friend:subuser_unshared",
                    "friend:removed"
                ])
            );

            const bobObservations = await storage.observationLog.findMany({ userId: bob.id, agentId: "agent-b" });
            expect(bobObservations.map((entry) => entry.type)).toContain("friend:accepted");
            expect(postToUserAgents).toHaveBeenCalled();
        } finally {
            storage.connection.close();
        }
    });
});
