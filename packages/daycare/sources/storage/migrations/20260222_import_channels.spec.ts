import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { databaseOpenTest } from "../databaseOpenTest.js";
import { migration20260220AddUsers } from "./20260220_add_users.js";
import { migration20260222AddChannels } from "./20260222_add_channels.js";
import { migration20260222ImportChannels } from "./20260222_import_channels.js";

describe("migration20260222ImportChannels", () => {
    it("imports legacy channel and history files", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-import-channels-"));
        const dbPath = path.join(dir, "daycare.db");

        try {
            const channelDir = path.join(dir, "channels", "dev");
            await mkdir(channelDir, { recursive: true });
            await writeFile(
                path.join(channelDir, "channel.json"),
                JSON.stringify(
                    {
                        id: "channel-1",
                        name: "dev",
                        leader: "agent-leader",
                        members: [
                            { agentId: "agent-a", username: "alice", joinedAt: 10 },
                            { agentId: "agent-b", username: "bob", joinedAt: 11 }
                        ],
                        createdAt: 1,
                        updatedAt: 2
                    },
                    null,
                    2
                ),
                "utf8"
            );
            await writeFile(
                path.join(channelDir, "history.jsonl"),
                `${JSON.stringify({ id: "msg-1", senderUsername: "alice", text: "hello", mentions: ["bob"], createdAt: 12 })}\n` +
                    `${JSON.stringify({ id: "msg-2", senderUsername: "bob", text: "hi", mentions: [], createdAt: 13 })}\n`,
                "utf8"
            );

            const db = databaseOpenTest();
            try {
                (db as typeof db & { __daycareDatabasePath?: string }).__daycareDatabasePath = dbPath;
                migration20260220AddUsers.up(db);
                db.prepare("INSERT INTO users (id, is_owner, created_at, updated_at) VALUES (?, ?, ?, ?)").run(
                    "owner-user",
                    1,
                    1,
                    1
                );
                db.exec(`
                    CREATE TABLE agents (
                        id TEXT PRIMARY KEY,
                        user_id TEXT NOT NULL
                    );
                `);
                db.prepare("INSERT INTO agents (id, user_id) VALUES (?, ?)").run("agent-leader", "user-leader");
                db.prepare("INSERT INTO agents (id, user_id) VALUES (?, ?)").run("agent-a", "user-a");
                migration20260222AddChannels.up(db);
                migration20260222ImportChannels.up(db);

                const channels = db.prepare("SELECT id, user_id, name, leader FROM channels").all() as Array<{
                    id: string;
                    user_id: string;
                    name: string;
                    leader: string;
                }>;
                const members = db
                    .prepare(
                        "SELECT channel_id, user_id, agent_id, username FROM channel_members ORDER BY agent_id ASC"
                    )
                    .all() as Array<{
                    channel_id: string;
                    user_id: string;
                    agent_id: string;
                    username: string;
                }>;
                const messages = db
                    .prepare("SELECT id, channel_id, user_id, sender_username FROM channel_messages ORDER BY id ASC")
                    .all() as Array<{
                    id: string;
                    channel_id: string;
                    user_id: string;
                    sender_username: string;
                }>;

                expect(channels).toEqual([
                    {
                        id: "channel-1",
                        user_id: "user-leader",
                        name: "dev",
                        leader: "agent-leader"
                    }
                ]);
                expect(members).toEqual([
                    {
                        channel_id: "channel-1",
                        user_id: "user-a",
                        agent_id: "agent-a",
                        username: "alice"
                    },
                    {
                        channel_id: "channel-1",
                        user_id: "user-leader",
                        agent_id: "agent-b",
                        username: "bob"
                    }
                ]);
                expect(messages).toEqual([
                    {
                        id: "msg-1",
                        channel_id: "channel-1",
                        user_id: "user-leader",
                        sender_username: "alice"
                    },
                    {
                        id: "msg-2",
                        channel_id: "channel-1",
                        user_id: "user-leader",
                        sender_username: "bob"
                    }
                ]);
            } finally {
                db.close();
            }
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });
});
