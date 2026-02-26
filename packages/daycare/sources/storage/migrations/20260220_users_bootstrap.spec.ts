import type { StorageDatabase as DatabaseSync } from "../databaseOpen.js";
import { createId } from "@paralleldrive/cuid2";
import { describe, expect, it } from "vitest";

import type { AgentDescriptor } from "@/types";
import { databaseOpen } from "../databaseOpen.js";
import { migration20260219Initial } from "./20260219_initial.js";
import { migration20260220AddUsers } from "./20260220_add_users.js";
import { migration20260220UsersBootstrap } from "./20260220_users_bootstrap.js";

describe("migration20260220UsersBootstrap", () => {
    it("creates one owner user when agents table is empty", () => {
        const db = databaseOpen(":memory:");
        try {
            migration20260219Initial.up(db);
            migration20260220AddUsers.up(db);
            migration20260220UsersBootstrap.up(db);

            const users = db.prepare("SELECT id, is_owner FROM users ORDER BY created_at ASC").all() as Array<{
                id: string;
                is_owner: number;
            }>;
            expect(users).toHaveLength(1);
            expect(users[0]?.is_owner).toBe(1);

            const columns = db.prepare("PRAGMA table_info(agents)").all() as Array<{ name: string; notnull: number }>;
            const userIdColumn = columns.find((column) => column.name === "user_id");
            expect(userIdColumn?.notnull).toBe(1);
        } finally {
            db.close();
        }
    });

    it("deduplicates connector identities and assigns shared user_id", () => {
        const db = databaseOpen(":memory:");
        try {
            migration20260219Initial.up(db);
            agentInsert(db, {
                id: "agent-a",
                descriptor: {
                    type: "user",
                    connector: "telegram",
                    userId: "123",
                    channelId: "channel-a"
                },
                createdAt: 10
            });
            agentInsert(db, {
                id: "agent-b",
                descriptor: {
                    type: "user",
                    connector: "telegram",
                    userId: "123",
                    channelId: "channel-b"
                },
                createdAt: 20
            });

            migration20260220AddUsers.up(db);
            migration20260220UsersBootstrap.up(db);

            const users = db.prepare("SELECT id, is_owner FROM users").all() as Array<{
                id: string;
                is_owner: number;
            }>;
            const connectorKeys = db.prepare("SELECT connector_key FROM user_connector_keys").all() as Array<{
                connector_key: string;
            }>;
            const agentUserIds = db.prepare("SELECT DISTINCT user_id FROM agents").all() as Array<{ user_id: string }>;

            expect(users).toHaveLength(1);
            expect(users[0]?.is_owner).toBe(1);
            expect(connectorKeys).toEqual([{ connector_key: "telegram:123" }]);
            expect(agentUserIds).toHaveLength(1);
        } finally {
            db.close();
        }
    });

    it("creates one user per connector identity and marks earliest as owner", () => {
        const db = databaseOpen(":memory:");
        try {
            migration20260219Initial.up(db);
            agentInsert(db, {
                id: "agent-a",
                descriptor: {
                    type: "user",
                    connector: "telegram",
                    userId: "123",
                    channelId: "channel-a"
                },
                createdAt: 10
            });
            agentInsert(db, {
                id: "agent-b",
                descriptor: {
                    type: "user",
                    connector: "whatsapp",
                    userId: "999",
                    channelId: "channel-b"
                },
                createdAt: 20
            });

            migration20260220AddUsers.up(db);
            migration20260220UsersBootstrap.up(db);

            const ownerRow = db
                .prepare(
                    `
            SELECT k.connector_key
            FROM users u
            JOIN user_connector_keys k ON k.user_id = u.id
            WHERE u.is_owner = 1
            LIMIT 1
          `
                )
                .get() as { connector_key?: string } | undefined;

            const users = db.prepare("SELECT id FROM users ORDER BY created_at ASC").all() as Array<{ id: string }>;
            expect(users).toHaveLength(2);
            expect(ownerRow?.connector_key).toBe("telegram:123");
        } finally {
            db.close();
        }
    });

    it("assigns owner user_id to non-user agents", () => {
        const db = databaseOpen(":memory:");
        try {
            migration20260219Initial.up(db);
            agentInsert(db, {
                id: "agent-user",
                descriptor: {
                    type: "user",
                    connector: "telegram",
                    userId: "123",
                    channelId: "channel-a"
                },
                createdAt: 10
            });
            agentInsert(db, {
                id: "agent-cron",
                descriptor: { type: "cron", id: createId(), name: "cron-job" },
                createdAt: 20
            });
            agentInsert(db, {
                id: "agent-system",
                descriptor: { type: "system", tag: "cron" },
                createdAt: 30
            });
            agentInsert(db, {
                id: "agent-sub",
                descriptor: {
                    type: "subagent",
                    id: createId(),
                    parentAgentId: createId(),
                    name: "subagent"
                },
                createdAt: 40
            });

            migration20260220AddUsers.up(db);
            migration20260220UsersBootstrap.up(db);

            const owner = db.prepare("SELECT id FROM users WHERE is_owner = 1 LIMIT 1").get() as
                | { id?: string }
                | undefined;
            const rows = db
                .prepare(
                    `
            SELECT id, user_id
            FROM agents
            WHERE id IN ('agent-cron', 'agent-system', 'agent-sub')
            ORDER BY id ASC
          `
                )
                .all() as Array<{ id: string; user_id: string }>;

            expect(rows).toEqual([
                { id: "agent-cron", user_id: owner?.id ?? "" },
                { id: "agent-sub", user_id: owner?.id ?? "" },
                { id: "agent-system", user_id: owner?.id ?? "" }
            ]);

            const indexes = db.prepare("PRAGMA index_list(agents)").all() as Array<{ name: string }>;
            expect(indexes.some((index) => index.name === "idx_agents_user_id")).toBe(true);
        } finally {
            db.close();
        }
    });
});

function agentInsert(db: DatabaseSync, input: { id: string; descriptor: AgentDescriptor; createdAt: number }): void {
    db.prepare(
        `
      INSERT INTO agents (
        id,
        type,
        descriptor,
        active_session_id,
        permissions,
        tokens,
        stats,
        lifecycle,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, NULL, ?, NULL, ?, ?, ?, ?)
    `
    ).run(
        input.id,
        input.descriptor.type,
        JSON.stringify(input.descriptor),
        JSON.stringify({
            workingDir: "/tmp",
            writeDirs: ["/tmp"],
            readDirs: ["/tmp"],
            network: false,
            events: false
        }),
        JSON.stringify({}),
        "active",
        input.createdAt,
        input.createdAt
    );
}
