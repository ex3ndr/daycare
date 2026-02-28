import { describe, expect, it } from "vitest";
import type { Context } from "@/types";
import { ChannelsRepository } from "./channelsRepository.js";
import { storageOpenTest } from "./storageOpenTest.js";

describe("ChannelsRepository", () => {
    it("supports channel CRUD with user filters", async () => {
        const storage = await storageOpenTest();
        try {
            const repository = new ChannelsRepository(storage.db);

            await repository.create({
                id: "channel-1",
                userId: "user-a",
                name: "dev",
                leader: "agent-leader",
                createdAt: 1,
                updatedAt: 1
            });
            await repository.create({
                id: "channel-2",
                userId: "user-b",
                name: "ops",
                leader: "agent-ops",
                createdAt: 2,
                updatedAt: 2
            });

            const all = await repository.findAll();
            const userA = await repository.findMany(ctxBuild("user-a"));
            const byName = await repository.findByName("dev");

            expect(all.map((entry) => entry.id)).toEqual(["channel-1", "channel-2"]);
            expect(userA.map((entry) => entry.id)).toEqual(["channel-1"]);
            expect(byName?.id).toBe("channel-1");

            const removed = await repository.delete("channel-2");
            const remaining = await repository.findAll();

            expect(removed).toBe(true);
            expect(remaining.map((entry) => entry.id)).toEqual(["channel-1"]);
        } finally {
            storage.connection.close();
        }
    });

    it("supports member operations", async () => {
        const storage = await storageOpenTest();
        try {
            const repository = new ChannelsRepository(storage.db);

            await repository.create({
                id: "channel-1",
                userId: "user-a",
                name: "dev",
                leader: "agent-leader",
                createdAt: 1,
                updatedAt: 1
            });

            await repository.addMember("channel-1", {
                userId: "user-a",
                agentId: "agent-a",
                username: "alice",
                joinedAt: 10
            });
            await repository.addMember("channel-1", {
                userId: "user-a",
                agentId: "agent-b",
                username: "bob",
                joinedAt: 11
            });

            const members = await repository.findMembers("channel-1");
            expect(members.map((entry) => entry.agentId)).toEqual(["agent-a", "agent-b"]);

            const removed = await repository.removeMember("channel-1", "agent-a");
            const after = await repository.findMembers("channel-1");

            expect(removed).toBe(true);
            expect(after.map((entry) => entry.agentId)).toEqual(["agent-b"]);
        } finally {
            storage.connection.close();
        }
    });
});

function ctxBuild(userId: string): Context {
    return { agentId: "test-agent", userId };
}
