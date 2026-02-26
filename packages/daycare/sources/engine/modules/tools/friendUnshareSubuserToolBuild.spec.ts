import { describe, expect, it, vi } from "vitest";

import type { ToolExecutionContext } from "@/types";
import type { Storage } from "../../../storage/storage.js";
import { storageOpen } from "../../../storage/storageOpen.js";
import { friendUnshareSubuserToolBuild } from "./friendUnshareSubuserToolBuild.js";

const toolCall = { id: "tool-1", name: "friend_unshare_subuser" };

describe("friendUnshareSubuserToolBuild", () => {
    it("revokes an active share and notifies the friend", async () => {
        const storage = storageOpen(":memory:");
        try {
            const alice = await storage.users.create({ id: "alice", nametag: "happy-penguin-42" });
            const bob = await storage.users.create({ id: "bob", nametag: "swift-fox-42" });
            const subuser = await storage.users.create({
                id: "alice-sub-1",
                parentUserId: alice.id,
                name: "helper",
                nametag: "cool-cat-11"
            });
            await storage.connections.upsertRequest(subuser.id, bob.id, 100);
            await storage.connections.upsertRequest(bob.id, subuser.id, 200);

            const postToUserAgents = vi.fn(async () => undefined);
            const tool = friendUnshareSubuserToolBuild();
            const result = await tool.execute(
                { friendNametag: "swift-fox-42", subuserId: subuser.id },
                contextBuild(alice.id, storage, postToUserAgents),
                toolCall
            );

            expect(result.typedResult.status).toBe("revoked");
            expect(postToUserAgents).toHaveBeenCalledWith(
                bob.id,
                expect.objectContaining({
                    type: "system_message",
                    origin: "friend:happy-penguin-42"
                })
            );

            const state = await storage.connections.find(subuser.id, bob.id);
            expect(state).toMatchObject({
                requestedA: false,
                requestedB: true
            });
        } finally {
            storage.db.close();
        }
    });

    it("revokes a pending share offer and removes the empty row", async () => {
        const storage = storageOpen(":memory:");
        try {
            const alice = await storage.users.create({ id: "alice", nametag: "happy-penguin-42" });
            const bob = await storage.users.create({ id: "bob", nametag: "swift-fox-42" });
            const subuser = await storage.users.create({
                id: "alice-sub-1",
                parentUserId: alice.id,
                name: "helper",
                nametag: "cool-cat-11"
            });
            await storage.connections.upsertRequest(subuser.id, bob.id, 100);

            const postToUserAgents = vi.fn(async () => undefined);
            const tool = friendUnshareSubuserToolBuild();
            const result = await tool.execute(
                { friendNametag: "swift-fox-42", subuserId: subuser.id },
                contextBuild(alice.id, storage, postToUserAgents),
                toolCall
            );

            expect(result.typedResult.status).toBe("revoked");
            expect(await storage.connections.find(subuser.id, bob.id)).toBeNull();
            expect(postToUserAgents).toHaveBeenCalledWith(
                bob.id,
                expect.objectContaining({
                    type: "system_message",
                    origin: "friend:happy-penguin-42"
                })
            );
        } finally {
            storage.db.close();
        }
    });

    it("fails when no share exists", async () => {
        const storage = storageOpen(":memory:");
        try {
            const alice = await storage.users.create({ id: "alice", nametag: "happy-penguin-42" });
            await storage.users.create({ id: "bob", nametag: "swift-fox-42" });
            await storage.users.create({
                id: "alice-sub-1",
                parentUserId: alice.id,
                name: "helper",
                nametag: "cool-cat-11"
            });
            const tool = friendUnshareSubuserToolBuild();

            await expect(
                tool.execute(
                    { friendNametag: "swift-fox-42", subuserId: "alice-sub-1" },
                    contextBuild(
                        alice.id,
                        storage,
                        vi.fn(async () => undefined)
                    ),
                    toolCall
                )
            ).rejects.toThrow("No share exists");
        } finally {
            storage.db.close();
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
