import { describe, expect, it } from "vitest";

import { databaseOpenTest } from "../databaseOpenTest.js";
import { migration20260222AddChannels } from "./20260222_add_channels.js";

describe("migration20260222AddChannels", () => {
    it("creates channels tables with expected columns", () => {
        const db = databaseOpenTest(":memory:");
        try {
            migration20260222AddChannels.up(db);

            const channels = db.prepare("PRAGMA table_info(channels)").all() as Array<{ name: string }>;
            const members = db.prepare("PRAGMA table_info(channel_members)").all() as Array<{ name: string }>;
            const messages = db.prepare("PRAGMA table_info(channel_messages)").all() as Array<{ name: string }>;

            expect(channels.map((column) => column.name)).toEqual([
                "id",
                "user_id",
                "name",
                "leader",
                "created_at",
                "updated_at"
            ]);
            expect(members.map((column) => column.name)).toEqual([
                "id",
                "channel_id",
                "user_id",
                "agent_id",
                "username",
                "joined_at"
            ]);
            expect(messages.map((column) => column.name)).toEqual([
                "id",
                "channel_id",
                "user_id",
                "sender_username",
                "text",
                "mentions",
                "created_at"
            ]);
        } finally {
            db.close();
        }
    });
});
