import { describe, expect, it } from "vitest";
import type { Context } from "@/types";

import { ChannelMessagesRepository } from "./channelMessagesRepository.js";
import { databaseOpenTest } from "./databaseOpenTest.js";

describe("ChannelMessagesRepository", () => {
    it("creates messages and returns recent entries", async () => {
        const db = databaseOpenTest();
        try {
            schemaCreate(db);
            const repository = new ChannelMessagesRepository(db);

            for (let index = 1; index <= 4; index += 1) {
                await repository.create({
                    id: `m-${index}`,
                    channelId: "channel-1",
                    userId: "user-a",
                    senderUsername: "alice",
                    text: `message-${index}`,
                    mentions: index % 2 === 0 ? ["bob"] : [],
                    createdAt: index
                });
            }

            const recent = await repository.findRecent(ctxBuild("user-a"), "channel-1", 2);
            expect(recent.map((entry) => entry.id)).toEqual(["m-3", "m-4"]);
            expect(recent[1]?.mentions).toEqual(["bob"]);
        } finally {
            db.close();
        }
    });
});

function schemaCreate(db: ReturnType<typeof databaseOpenTest>): void {
    db.exec(`
        CREATE TABLE channel_messages (
            id TEXT PRIMARY KEY,
            channel_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            sender_username TEXT NOT NULL,
            text TEXT NOT NULL,
            mentions TEXT NOT NULL,
            created_at INTEGER NOT NULL
        );
    `);
}

function ctxBuild(userId: string): Context {
    return { agentId: "test-agent", userId };
}
