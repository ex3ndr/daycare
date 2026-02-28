import { describe, expect, it, vi } from "vitest";

import type { ToolExecutionContext } from "@/types";
import type { Storage } from "../../../storage/storage.js";
import { storageOpenTest } from "../../../storage/storageOpenTest.js";
import { friendShareSubuserToolBuild } from "./friendShareSubuserToolBuild.js";

const toolCall = { id: "tool-1", name: "friend_share_subuser" };

describe("friendShareSubuserToolBuild", () => {
    it("shares a subuser with an existing friend", async () => {
        const storage = await storageOpenTest();
        try {
            const alice = await storage.users.create({ id: "alice", nametag: "happy-penguin-42" });
            const bob = await storage.users.create({ id: "bob", nametag: "swift-fox-42" });
            await storage.users.create({ id: "charlie", nametag: "brave-eagle-77" });
            const subuser = await storage.users.create({
                id: "alice-sub-1",
                parentUserId: alice.id,
                name: "helper",
                nametag: "cool-cat-11"
            });
            await storage.connections.upsertRequest(alice.id, bob.id, 100);
            await storage.connections.upsertRequest(bob.id, alice.id, 200);

            const postToUserAgents = vi.fn(async () => undefined);
            const tool = friendShareSubuserToolBuild();
            const result = await tool.execute(
                { friendNametag: "swift-fox-42", subuserId: subuser.id },
                contextBuild(alice.id, storage, postToUserAgents),
                toolCall
            );

            expect(result.typedResult.status).toBe("offered");
            expect(postToUserAgents).toHaveBeenCalledWith(
                bob.id,
                expect.objectContaining({
                    type: "system_message",
                    origin: "friend:happy-penguin-42",
                    text: expect.stringContaining('Use friend_add("cool-cat-11") to accept.')
                })
            );

            const share = await storage.connections.find(subuser.id, bob.id);
            expect(share).toMatchObject({
                requestedA: true,
                requestedB: false
            });
        } finally {
            storage.connection.close();
        }
    });

    it("fails when owner and friend are not connected", async () => {
        const storage = await storageOpenTest();
        try {
            const alice = await storage.users.create({ id: "alice", nametag: "happy-penguin-42" });
            await storage.users.create({ id: "bob", nametag: "swift-fox-42" });
            const subuser = await storage.users.create({
                id: "alice-sub-1",
                parentUserId: alice.id,
                name: "helper",
                nametag: "cool-cat-11"
            });
            const tool = friendShareSubuserToolBuild();

            await expect(
                tool.execute(
                    { friendNametag: "swift-fox-42", subuserId: subuser.id },
                    contextBuild(
                        alice.id,
                        storage,
                        vi.fn(async () => undefined)
                    ),
                    toolCall
                )
            ).rejects.toThrow("You are not friends");
        } finally {
            storage.connection.close();
        }
    });

    it("fails when caller does not own the subuser", async () => {
        const storage = await storageOpenTest();
        try {
            const alice = await storage.users.create({ id: "alice", nametag: "happy-penguin-42" });
            const bob = await storage.users.create({ id: "bob", nametag: "swift-fox-42" });
            await storage.users.create({ id: "charlie", nametag: "brave-eagle-77" });
            const subuser = await storage.users.create({
                id: "alice-sub-1",
                parentUserId: alice.id,
                name: "helper",
                nametag: "cool-cat-11"
            });
            await storage.connections.upsertRequest(alice.id, bob.id, 100);
            await storage.connections.upsertRequest(bob.id, alice.id, 200);
            const tool = friendShareSubuserToolBuild();

            await expect(
                tool.execute(
                    { friendNametag: "brave-eagle-77", subuserId: subuser.id },
                    contextBuild(
                        bob.id,
                        storage,
                        vi.fn(async () => undefined)
                    ),
                    toolCall
                )
            ).rejects.toThrow("Subuser does not belong to the calling user.");
        } finally {
            storage.connection.close();
        }
    });

    it("fails when share is already active", async () => {
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

            await storage.connections.upsertRequest(alice.id, bob.id, 100);
            await storage.connections.upsertRequest(bob.id, alice.id, 200);
            await storage.connections.upsertRequest(subuser.id, bob.id, 300);
            await storage.connections.upsertRequest(bob.id, subuser.id, 400);

            const tool = friendShareSubuserToolBuild();
            await expect(
                tool.execute(
                    { friendNametag: "swift-fox-42", subuserId: subuser.id },
                    contextBuild(
                        alice.id,
                        storage,
                        vi.fn(async () => undefined)
                    ),
                    toolCall
                )
            ).rejects.toThrow("already shared");
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
        } as unknown as ToolExecutionContext["agentSystem"],
        heartbeats: null as unknown as ToolExecutionContext["heartbeats"]
    };
}
