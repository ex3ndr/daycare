import { describe, expect, it } from "vitest";
import type { Context } from "@/types";
import { channelsTable } from "../schema.js";

import { ChannelMessagesRepository } from "./channelMessagesRepository.js";
import { storageOpenTest } from "./storageOpenTest.js";

describe("ChannelMessagesRepository", () => {
    it("creates messages and returns recent entries", async () => {
        const storage = await storageOpenTest();
        try {
            const repository = new ChannelMessagesRepository(storage.db);

            // Create parent channel required by FK constraint
            await storage.db.insert(channelsTable).values({
                id: "channel-1",
                version: 1,
                validFrom: 1,
                validTo: null,
                userId: "user-a",
                name: "test-channel",
                leader: "user-a",
                createdAt: 1,
                updatedAt: 1
            });

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
            await storage.connection.close();
        }
    });
});

function ctxBuild(userId: string): Context {
    return { agentId: "test-agent", userId };
}
