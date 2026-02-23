import { describe, expect, it, vi } from "vitest";

import type { ToolExecutionContext } from "@/types";
import { Storage } from "../../../storage/storage.js";
import { friendSendToolBuild } from "./friendSendToolBuild.js";

const toolCall = { id: "tool-1", name: "friend_send" };

describe("friendSendToolBuild", () => {
    it("sends a friend message to the target user's frontend agents", async () => {
        const storage = Storage.open(":memory:");
        try {
            const alice = await storage.users.create({ id: "alice", usertag: "happy-penguin-42" });
            const bob = await storage.users.create({ id: "bob", usertag: "swift-fox-42" });
            await storage.connections.upsertRequest(alice.id, bob.id, 100);
            await storage.connections.upsertRequest(bob.id, alice.id, 200);

            const postToUserAgents = vi.fn(async () => undefined);
            const tool = friendSendToolBuild();
            const result = await tool.execute(
                { usertag: "swift-fox-42", message: "Hello <friend> & crew" },
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
            storage.close();
        }
    });

    it("fails when users are not friends", async () => {
        const storage = Storage.open(":memory:");
        try {
            const alice = await storage.users.create({ id: "alice", usertag: "happy-penguin-42" });
            await storage.users.create({ id: "bob", usertag: "swift-fox-42" });
            const tool = friendSendToolBuild();

            await expect(
                tool.execute(
                    { usertag: "swift-fox-42", message: "Hello" },
                    contextBuild(
                        alice.id,
                        storage,
                        vi.fn(async () => undefined)
                    ),
                    toolCall
                )
            ).rejects.toThrow("You are not friends");
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
