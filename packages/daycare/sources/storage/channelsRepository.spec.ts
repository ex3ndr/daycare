import { describe, expect, it } from "vitest";
import type { Context } from "@/types";
import { ChannelsRepository } from "./channelsRepository.js";
import { databaseOpenTest } from "./databaseOpenTest.js";

describe("ChannelsRepository", () => {
    it("supports channel CRUD with user filters", async () => {
        const db = databaseOpenTest(":memory:");
        try {
            schemaCreate(db);
            const repository = new ChannelsRepository(db);

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
            db.close();
        }
    });

    it("supports member operations", async () => {
        const db = databaseOpenTest(":memory:");
        try {
            schemaCreate(db);
            const repository = new ChannelsRepository(db);

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
            db.close();
        }
    });
});

function schemaCreate(db: ReturnType<typeof databaseOpenTest>): void {
    db.exec(`
        PRAGMA foreign_keys = ON;

        CREATE TABLE channels (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            name TEXT NOT NULL UNIQUE,
            leader TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );

        CREATE TABLE channel_members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
            user_id TEXT NOT NULL,
            agent_id TEXT NOT NULL,
            username TEXT NOT NULL,
            joined_at INTEGER NOT NULL,
            UNIQUE(channel_id, agent_id)
        );
    `);
}

function ctxBuild(userId: string): Context {
    return { agentId: "test-agent", userId };
}
