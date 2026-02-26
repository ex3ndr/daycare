import { describe, expect, it, vi } from "vitest";

import type { ToolExecutionContext } from "@/types";
import type { Storage } from "../../../storage/storage.js";
import { storageOpen } from "../../../storage/storageOpen.js";
import { friendSendToolBuild } from "./friendSendToolBuild.js";

const toolCall = { id: "tool-1", name: "friend_send" };

describe("friendSendToolBuild", () => {
    it("sends a friend message to the target user's frontend agents", async () => {
        const storage = storageOpen(":memory:");
        try {
            const alice = await storage.users.create({ id: "alice", nametag: "happy-penguin-42" });
            const bob = await storage.users.create({ id: "bob", nametag: "swift-fox-42" });
            await storage.connections.upsertRequest(alice.id, bob.id, 100);
            await storage.connections.upsertRequest(bob.id, alice.id, 200);

            const postToUserAgents = vi.fn(async () => undefined);
            const tool = friendSendToolBuild();
            const result = await tool.execute(
                { nametag: "swift-fox-42", message: "Hello <friend> & crew" },
                contextBuild(alice.id, storage, postToUserAgents),
                toolCall
            );

            expect(result.typedResult.summary).toContain("Sent message");
            expect(postToUserAgents).toHaveBeenCalledWith(
                bob.id,
                expect.objectContaining({
                    type: "system_message",
                    origin: "friend:happy-penguin-42",
                    text: expect.stringContaining("Hello &lt;friend&gt; &amp; crew")
                })
            );
        } finally {
            storage.db.close();
        }
    });

    it("fails when users are not friends", async () => {
        const storage = storageOpen(":memory:");
        try {
            const alice = await storage.users.create({ id: "alice", nametag: "happy-penguin-42" });
            await storage.users.create({ id: "bob", nametag: "swift-fox-42" });
            const tool = friendSendToolBuild();

            await expect(
                tool.execute(
                    { nametag: "swift-fox-42", message: "Hello" },
                    contextBuild(
                        alice.id,
                        storage,
                        vi.fn(async () => undefined)
                    ),
                    toolCall
                )
            ).rejects.toThrow("You are not friends");
        } finally {
            storage.db.close();
        }
    });

    it("sends to a shared subuser gateway agent", async () => {
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

            await storage.agents.create({
                id: "subuser-gateway",
                userId: subuser.id,
                type: "subuser",
                descriptor: { type: "subuser", id: subuser.id, name: "helper", systemPrompt: "prompt" },
                activeSessionId: null,
                permissions: { workingDir: "/tmp", writeDirs: ["/tmp"] },
                tokens: null,
                stats: {},
                lifecycle: "active",
                createdAt: 1,
                updatedAt: 1
            });

            await storage.connections.upsertRequest(subuser.id, bob.id, 100);
            await storage.connections.upsertRequest(bob.id, subuser.id, 200);

            const postToUserAgents = vi.fn(async () => undefined);
            const post = vi.fn(async () => undefined);
            const tool = friendSendToolBuild();
            const result = await tool.execute(
                { nametag: "cool-cat-11", message: "Hello helper" },
                contextBuild(bob.id, storage, postToUserAgents, post),
                toolCall
            );

            expect(result.typedResult.summary).toContain("Sent message");
            expect(post).toHaveBeenCalledWith(
                expect.objectContaining({ userId: "alice-sub-1" }),
                { agentId: "subuser-gateway" },
                expect.objectContaining({
                    type: "system_message",
                    origin: "friend:swift-fox-42",
                    text: expect.stringContaining("Message from swift-fox-42: Hello helper")
                })
            );
            expect(postToUserAgents).not.toHaveBeenCalled();
        } finally {
            storage.db.close();
        }
    });

    it("fails when subuser share is not active", async () => {
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

            const tool = friendSendToolBuild();
            await expect(
                tool.execute(
                    { nametag: "cool-cat-11", message: "Hello" },
                    contextBuild(
                        bob.id,
                        storage,
                        vi.fn(async () => undefined),
                        vi.fn(async () => undefined)
                    ),
                    toolCall
                )
            ).rejects.toThrow("No active shared access");
        } finally {
            storage.db.close();
        }
    });
});

function contextBuild(
    userId: string,
    storage: Storage,
    postToUserAgents: (targetUserId: string, item: unknown) => Promise<void>,
    post: (ctx: unknown, target: unknown, item: unknown) => Promise<void> = async () => undefined
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
            postToUserAgents,
            post
        } as unknown as ToolExecutionContext["agentSystem"],
        heartbeats: null as unknown as ToolExecutionContext["heartbeats"]
    };
}
