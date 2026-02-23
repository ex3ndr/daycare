import { describe, expect, it, vi } from "vitest";

import type { ToolExecutionContext } from "@/types";
import { Storage } from "../../../storage/storage.js";
import { contextForAgent } from "../../agents/context.js";
import { friendAddToolBuild } from "./friendAddToolBuild.js";

const toolCall = { id: "tool-1", name: "friend_add" };

describe("friendAddToolBuild", () => {
    it("sends a request and confirms when the other side adds back", async () => {
        const storage = Storage.open(":memory:");
        try {
            const alice = await storage.users.create({ id: "alice", nametag: "happy-penguin-42" });
            const bob = await storage.users.create({ id: "bob", nametag: "swift-fox-42" });
            const postToUserAgents = vi.fn(async () => undefined);
            const tool = friendAddToolBuild();

            const requestResult = await tool.execute(
                { nametag: "swift-fox-42" },
                contextBuild(alice.id, storage, postToUserAgents),
                toolCall
            );
            expect(requestResult.typedResult.status).toBe("requested");
            expect(postToUserAgents).toHaveBeenCalledWith(
                bob.id,
                expect.objectContaining({
                    type: "system_message",
                    origin: "friend:happy-penguin-42"
                })
            );

            const pending = await storage.connections.find(alice.id, bob.id);
            expect(pending?.requestedA).toBe(true);
            expect(pending?.requestedB).toBe(false);

            postToUserAgents.mockClear();
            const confirmResult = await tool.execute(
                { nametag: "happy-penguin-42" },
                contextBuild(bob.id, storage, postToUserAgents),
                toolCall
            );
            expect(confirmResult.typedResult.status).toBe("accepted");
            expect(postToUserAgents).toHaveBeenCalledWith(
                alice.id,
                expect.objectContaining({
                    type: "system_message",
                    origin: "friend:swift-fox-42"
                })
            );

            const friends = await storage.connections.find(alice.id, bob.id);
            expect(friends?.requestedA).toBe(true);
            expect(friends?.requestedB).toBe(true);
        } finally {
            storage.close();
        }
    });

    it("accepts a pending subuser share and notifies the owner", async () => {
        const storage = Storage.open(":memory:");
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

            const postToUserAgents = vi.fn(async () => undefined);
            const tool = friendAddToolBuild();
            const result = await tool.execute(
                { nametag: "cool-cat-11" },
                contextBuild(bob.id, storage, postToUserAgents),
                toolCall
            );

            expect(result.typedResult.status).toBe("accepted_share");
            expect(postToUserAgents).toHaveBeenCalledWith(
                alice.id,
                expect.objectContaining({
                    type: "system_message",
                    origin: "friend:swift-fox-42"
                })
            );

            const share = await storage.connections.find(subuser.id, bob.id);
            expect(share?.requestedA).toBe(true);
            expect(share?.requestedB).toBe(true);
        } finally {
            storage.close();
        }
    });

    it("rejects subuser accept when no pending offer exists", async () => {
        const storage = Storage.open(":memory:");
        try {
            const alice = await storage.users.create({ id: "alice", nametag: "happy-penguin-42" });
            const bob = await storage.users.create({ id: "bob", nametag: "swift-fox-42" });
            await storage.users.create({
                id: "alice-sub-1",
                parentUserId: alice.id,
                name: "helper",
                nametag: "cool-cat-11"
            });
            await storage.connections.upsertRequest(alice.id, bob.id, 100);
            await storage.connections.upsertRequest(bob.id, alice.id, 200);
            const tool = friendAddToolBuild();

            await expect(
                tool.execute(
                    { nametag: "cool-cat-11" },
                    contextBuild(
                        bob.id,
                        storage,
                        vi.fn(async () => undefined)
                    ),
                    toolCall
                )
            ).rejects.toThrow("No pending share request for this subuser.");
        } finally {
            storage.close();
        }
    });

    it("rejects subuser accept when caller is not friends with owner", async () => {
        const storage = Storage.open(":memory:");
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
            const tool = friendAddToolBuild();

            await expect(
                tool.execute(
                    { nametag: "cool-cat-11" },
                    contextBuild(
                        bob.id,
                        storage,
                        vi.fn(async () => undefined)
                    ),
                    toolCall
                )
            ).rejects.toThrow("You are not friends with subuser owner");
        } finally {
            storage.close();
        }
    });

    it("enforces cooldown after a rejected request", async () => {
        const storage = Storage.open(":memory:");
        try {
            const alice = await storage.users.create({ id: "alice", nametag: "happy-penguin-42" });
            const bob = await storage.users.create({ id: "bob", nametag: "swift-fox-42" });
            const tool = friendAddToolBuild();

            await storage.connections.upsertRequest(alice.id, bob.id, Date.now() - 1_000);
            await storage.connections.clearSide(alice.id, bob.id);

            await expect(
                tool.execute(
                    { nametag: "swift-fox-42" },
                    contextBuild(
                        alice.id,
                        storage,
                        vi.fn(async () => undefined)
                    ),
                    toolCall
                )
            ).rejects.toThrow("Friend request cooldown is active");
        } finally {
            storage.close();
        }
    });

    it("is visible only to user agents", () => {
        const tool = friendAddToolBuild();
        expect(
            tool.visibleByDefault?.({
                ctx: contextForAgent({ userId: "u1", agentId: "a1" }),
                descriptor: { type: "user", connector: "telegram", userId: "u1", channelId: "c1" }
            })
        ).toBe(true);
        expect(
            tool.visibleByDefault?.({
                ctx: contextForAgent({ userId: "u1", agentId: "a1" }),
                descriptor: { type: "subagent", id: "s1", parentAgentId: "a1", name: "worker" }
            })
        ).toBe(false);
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
