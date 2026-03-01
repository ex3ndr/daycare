import { describe, expect, it, vi } from "vitest";

import type { ToolExecutionContext } from "@/types";
import type { Storage } from "../../../storage/storage.js";
import { storageOpenTest } from "../../../storage/storageOpenTest.js";
import { Friends } from "../../friends/friends.js";
import { friendRemoveToolBuild } from "./friendRemoveToolBuild.js";

const toolCall = { id: "tool-1", name: "friend_remove" };

describe("friendRemoveToolBuild", () => {
    it("unfriends and notifies the other user", async () => {
        const storage = await storageOpenTest();
        try {
            const alice = await storage.users.create({ id: "alice", nametag: "happy-penguin-42" });
            const bob = await storage.users.create({ id: "bob", nametag: "swift-fox-42" });
            await storage.connections.upsertRequest(alice.id, bob.id, 100);
            await storage.connections.upsertRequest(bob.id, alice.id, 200);

            const postToUserAgents = vi.fn(async () => undefined);
            const tool = friendRemoveToolBuild(new Friends({ storage, postToUserAgents }));
            const result = await tool.execute(
                { nametag: "swift-fox-42" },
                contextBuild(alice.id, storage, postToUserAgents),
                toolCall
            );

            expect(result.typedResult.status).toBe("unfriended");
            expect(postToUserAgents).toHaveBeenCalledWith(
                bob.id,
                expect.objectContaining({ type: "system_message", origin: "friend:happy-penguin-42" })
            );

            const state = await storage.connections.find(alice.id, bob.id);
            expect(state?.requestedA).toBe(false);
            expect(state?.requestedB).toBe(true);
        } finally {
            storage.connection.close();
        }
    });

    it("rejects a pending incoming request without notification", async () => {
        const storage = await storageOpenTest();
        try {
            const alice = await storage.users.create({ id: "alice", nametag: "happy-penguin-42" });
            const bob = await storage.users.create({ id: "bob", nametag: "swift-fox-42" });
            await storage.connections.upsertRequest(bob.id, alice.id, 100);

            const postToUserAgents = vi.fn(async () => undefined);
            const tool = friendRemoveToolBuild(new Friends({ storage, postToUserAgents }));
            const result = await tool.execute(
                { nametag: "swift-fox-42" },
                contextBuild(alice.id, storage, postToUserAgents),
                toolCall
            );

            expect(result.typedResult.status).toBe("rejected");
            expect(postToUserAgents).not.toHaveBeenCalled();

            const state = await storage.connections.find(alice.id, bob.id);
            expect(state?.requestedA).toBe(false);
            expect(state?.requestedB).toBe(false);
        } finally {
            storage.connection.close();
        }
    });

    it("cancels an outgoing pending request", async () => {
        const storage = await storageOpenTest();
        try {
            const alice = await storage.users.create({ id: "alice", nametag: "happy-penguin-42" });
            const bob = await storage.users.create({ id: "bob", nametag: "swift-fox-42" });
            await storage.connections.upsertRequest(alice.id, bob.id, 100);

            const postToUserAgents = vi.fn(async () => undefined);
            const tool = friendRemoveToolBuild(new Friends({ storage, postToUserAgents }));
            const result = await tool.execute(
                { nametag: "swift-fox-42" },
                contextBuild(alice.id, storage, postToUserAgents),
                toolCall
            );

            expect(result.typedResult.status).toBe("canceled");
            expect(postToUserAgents).not.toHaveBeenCalled();

            const state = await storage.connections.find(alice.id, bob.id);
            expect(state?.requestedA).toBe(false);
            expect(state?.requestedB).toBe(false);
        } finally {
            storage.connection.close();
        }
    });

    it("unfriends an active child-user relationship and notifies that user", async () => {
        const storage = await storageOpenTest();
        try {
            const owner = await storage.users.create({ id: "owner", nametag: "happy-penguin-42" });
            const bob = await storage.users.create({ id: "bob", nametag: "swift-fox-42" });
            const subuser = await storage.users.create({
                id: "owner-sub-1",
                parentUserId: owner.id,
                firstName: "helper",
                nametag: "cool-cat-11"
            });
            await storage.connections.upsertRequest(subuser.id, bob.id, 100);
            await storage.connections.upsertRequest(bob.id, subuser.id, 200);

            const postToUserAgents = vi.fn(async () => undefined);
            const tool = friendRemoveToolBuild(new Friends({ storage, postToUserAgents }));
            const result = await tool.execute(
                { nametag: "cool-cat-11" },
                contextBuild(bob.id, storage, postToUserAgents),
                toolCall
            );

            expect(result.typedResult.status).toBe("unfriended");
            expect(postToUserAgents).toHaveBeenCalledWith(
                subuser.id,
                expect.objectContaining({ type: "system_message", origin: "friend:swift-fox-42" })
            );

            const state = await storage.connections.find(subuser.id, bob.id);
            if (state?.userAId === bob.id) {
                expect(state.requestedA).toBe(false);
                expect(state.requestedB).toBe(true);
            } else {
                expect(state?.requestedA).toBe(true);
                expect(state?.requestedB).toBe(false);
            }
        } finally {
            storage.connection.close();
        }
    });

    it("rejects an incoming child-user offer without notification", async () => {
        const storage = await storageOpenTest();
        try {
            const owner = await storage.users.create({ id: "owner", nametag: "happy-penguin-42" });
            const bob = await storage.users.create({ id: "bob", nametag: "swift-fox-42" });
            const subuser = await storage.users.create({
                id: "owner-sub-1",
                parentUserId: owner.id,
                firstName: "helper",
                nametag: "cool-cat-11"
            });
            await storage.connections.upsertRequest(subuser.id, bob.id, 100);

            const postToUserAgents = vi.fn(async () => undefined);
            const tool = friendRemoveToolBuild(new Friends({ storage, postToUserAgents }));
            const result = await tool.execute(
                { nametag: "cool-cat-11" },
                contextBuild(bob.id, storage, postToUserAgents),
                toolCall
            );

            expect(result.typedResult.status).toBe("rejected");
            expect(postToUserAgents).not.toHaveBeenCalled();
            const state = await storage.connections.find(subuser.id, bob.id);
            expect(state?.requestedA).toBe(false);
            expect(state?.requestedB).toBe(false);
        } finally {
            storage.connection.close();
        }
    });

    it("does not cascade unrelated child-user relationships when unfriending a user", async () => {
        const storage = await storageOpenTest();
        try {
            const alice = await storage.users.create({ id: "alice", nametag: "happy-penguin-42" });
            const bob = await storage.users.create({ id: "bob", nametag: "swift-fox-42" });
            const aliceSub = await storage.users.create({
                id: "alice-sub-1",
                parentUserId: alice.id,
                firstName: "a-helper",
                nametag: "cool-cat-11"
            });
            const bobSub = await storage.users.create({
                id: "bob-sub-1",
                parentUserId: bob.id,
                firstName: "b-helper",
                nametag: "smart-owl-22"
            });

            await storage.connections.upsertRequest(alice.id, bob.id, 100);
            await storage.connections.upsertRequest(bob.id, alice.id, 200);
            await storage.connections.upsertRequest(aliceSub.id, bob.id, 300);
            await storage.connections.upsertRequest(bob.id, aliceSub.id, 400);
            await storage.connections.upsertRequest(bobSub.id, alice.id, 500);
            await storage.connections.upsertRequest(alice.id, bobSub.id, 600);

            const postToUserAgents = vi.fn(async () => undefined);
            const tool = friendRemoveToolBuild(new Friends({ storage, postToUserAgents }));
            const result = await tool.execute(
                { nametag: "swift-fox-42" },
                contextBuild(alice.id, storage, postToUserAgents),
                toolCall
            );

            expect(result.typedResult.status).toBe("unfriended");
            const aliceSubConnection = await storage.connections.find(aliceSub.id, bob.id);
            const bobSubConnection = await storage.connections.find(bobSub.id, alice.id);
            expect(aliceSubConnection?.requestedA).toBe(true);
            expect(aliceSubConnection?.requestedB).toBe(true);
            expect(bobSubConnection?.requestedA).toBe(true);
            expect(bobSubConnection?.requestedB).toBe(true);
        } finally {
            storage.connection.close();
        }
    });
});

function contextBuild(
    userId: string,
    storage: Storage,
    postToUserAgents: (targetUserId: string, item: unknown) => Promise<void>
): ToolExecutionContext {
    return {
        connectorRegistry: null as unknown as ToolExecutionContext["connectorRegistry"],
        sandbox: null as unknown as ToolExecutionContext["sandbox"],
        auth: null as unknown as ToolExecutionContext["auth"],
        logger: console as unknown as ToolExecutionContext["logger"],
        assistant: null,
        agent: { id: "agent-1" } as unknown as ToolExecutionContext["agent"],
        ctx: { userId, agentId: "agent-1" } as ToolExecutionContext["ctx"],
        source: "test",
        messageContext: {},
        agentSystem: {
            storage,
            postToUserAgents
        } as unknown as ToolExecutionContext["agentSystem"]
    };
}
