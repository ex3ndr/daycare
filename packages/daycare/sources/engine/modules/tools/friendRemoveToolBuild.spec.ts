import { describe, expect, it, vi } from "vitest";

import type { ToolExecutionContext } from "@/types";
import { Storage } from "../../../storage/storage.js";
import { friendRemoveToolBuild } from "./friendRemoveToolBuild.js";

const toolCall = { id: "tool-1", name: "friend_remove" };

describe("friendRemoveToolBuild", () => {
    it("unfriends and notifies the other user", async () => {
        const storage = Storage.open(":memory:");
        try {
            const alice = await storage.users.create({ id: "alice", nametag: "happy-penguin-42" });
            const bob = await storage.users.create({ id: "bob", nametag: "swift-fox-42" });
            await storage.connections.upsertRequest(alice.id, bob.id, 100);
            await storage.connections.upsertRequest(bob.id, alice.id, 200);

            const postToUserAgents = vi.fn(async () => undefined);
            const tool = friendRemoveToolBuild();
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
            storage.close();
        }
    });

    it("rejects a pending incoming request without notification", async () => {
        const storage = Storage.open(":memory:");
        try {
            const alice = await storage.users.create({ id: "alice", nametag: "happy-penguin-42" });
            const bob = await storage.users.create({ id: "bob", nametag: "swift-fox-42" });
            await storage.connections.upsertRequest(bob.id, alice.id, 100);

            const postToUserAgents = vi.fn(async () => undefined);
            const tool = friendRemoveToolBuild();
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
            storage.close();
        }
    });

    it("cancels an outgoing pending request", async () => {
        const storage = Storage.open(":memory:");
        try {
            const alice = await storage.users.create({ id: "alice", nametag: "happy-penguin-42" });
            const bob = await storage.users.create({ id: "bob", nametag: "swift-fox-42" });
            await storage.connections.upsertRequest(alice.id, bob.id, 100);

            const postToUserAgents = vi.fn(async () => undefined);
            const tool = friendRemoveToolBuild();
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
            storage.close();
        }
    });

    it("removes an active shared subuser and notifies the owner", async () => {
        const storage = Storage.open(":memory:");
        try {
            const owner = await storage.users.create({ id: "owner", nametag: "happy-penguin-42" });
            const bob = await storage.users.create({ id: "bob", nametag: "swift-fox-42" });
            const subuser = await storage.users.create({
                id: "owner-sub-1",
                parentUserId: owner.id,
                name: "helper",
                nametag: "cool-cat-11"
            });
            await storage.connections.upsertRequest(subuser.id, bob.id, 100);
            await storage.connections.upsertRequest(bob.id, subuser.id, 200);

            const postToUserAgents = vi.fn(async () => undefined);
            const tool = friendRemoveToolBuild();
            const result = await tool.execute(
                { nametag: "cool-cat-11" },
                contextBuild(bob.id, storage, postToUserAgents),
                toolCall
            );

            expect(result.typedResult.status).toBe("removed_share");
            expect(postToUserAgents).toHaveBeenCalledWith(
                owner.id,
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
            storage.close();
        }
    });

    it("rejects an incoming shared subuser offer without notification", async () => {
        const storage = Storage.open(":memory:");
        try {
            const owner = await storage.users.create({ id: "owner", nametag: "happy-penguin-42" });
            const bob = await storage.users.create({ id: "bob", nametag: "swift-fox-42" });
            const subuser = await storage.users.create({
                id: "owner-sub-1",
                parentUserId: owner.id,
                name: "helper",
                nametag: "cool-cat-11"
            });
            await storage.connections.upsertRequest(subuser.id, bob.id, 100);

            const postToUserAgents = vi.fn(async () => undefined);
            const tool = friendRemoveToolBuild();
            const result = await tool.execute(
                { nametag: "cool-cat-11" },
                contextBuild(bob.id, storage, postToUserAgents),
                toolCall
            );

            expect(result.typedResult.status).toBe("rejected_share");
            expect(postToUserAgents).not.toHaveBeenCalled();
            expect(await storage.connections.find(subuser.id, bob.id)).toBeNull();
        } finally {
            storage.close();
        }
    });

    it("cascades subuser-share cleanup when unfriending a user", async () => {
        const storage = Storage.open(":memory:");
        try {
            const alice = await storage.users.create({ id: "alice", nametag: "happy-penguin-42" });
            const bob = await storage.users.create({ id: "bob", nametag: "swift-fox-42" });
            const aliceSub = await storage.users.create({
                id: "alice-sub-1",
                parentUserId: alice.id,
                name: "a-helper",
                nametag: "cool-cat-11"
            });
            const bobSub = await storage.users.create({
                id: "bob-sub-1",
                parentUserId: bob.id,
                name: "b-helper",
                nametag: "smart-owl-22"
            });

            await storage.connections.upsertRequest(alice.id, bob.id, 100);
            await storage.connections.upsertRequest(bob.id, alice.id, 200);
            await storage.connections.upsertRequest(aliceSub.id, bob.id, 300);
            await storage.connections.upsertRequest(bob.id, aliceSub.id, 400);
            await storage.connections.upsertRequest(bobSub.id, alice.id, 500);
            await storage.connections.upsertRequest(alice.id, bobSub.id, 600);

            const postToUserAgents = vi.fn(async () => undefined);
            const tool = friendRemoveToolBuild();
            const result = await tool.execute(
                { nametag: "swift-fox-42" },
                contextBuild(alice.id, storage, postToUserAgents),
                toolCall
            );

            expect(result.typedResult.status).toBe("unfriended");
            expect(await storage.connections.find(aliceSub.id, bob.id)).toBeNull();
            expect(await storage.connections.find(bobSub.id, alice.id)).toBeNull();
        } finally {
            storage.close();
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
        } as unknown as ToolExecutionContext["agentSystem"],
        heartbeats: null as unknown as ToolExecutionContext["heartbeats"]
    };
}
