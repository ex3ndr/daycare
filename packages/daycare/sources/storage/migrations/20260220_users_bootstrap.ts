import { createId } from "@paralleldrive/cuid2";
import { userConnectorKeyCreate } from "../userConnectorKeyCreate.js";
import type { Migration } from "./migrationTypes.js";

type UserAgentRow = {
    id: string;
    descriptor: string;
    created_at: number;
};

type ParsedUserDescriptor = {
    connector: string;
    userId: string;
};

export const migration20260220UsersBootstrap: Migration = {
    name: "20260220_users_bootstrap",
    up(db): void {
        // 1) Collect existing user agents in creation order.
        const userAgents = db
            .prepare(
                `
          SELECT id, descriptor, created_at
          FROM agents
          WHERE type = 'user'
          ORDER BY created_at ASC
        `
            )
            .all() as UserAgentRow[];

        // 2) Build connector key map and unique ordered connector keys.
        const connectorKeyByAgentId = new Map<string, string>();
        const connectorKeysInOrder: string[] = [];
        for (const row of userAgents) {
            const parsed = userDescriptorParse(row.descriptor);
            if (!parsed) {
                continue;
            }
            const connectorKey = userConnectorKeyCreate(parsed.connector, parsed.userId);
            connectorKeyByAgentId.set(row.id, connectorKey);
            if (!connectorKeysInOrder.includes(connectorKey)) {
                connectorKeysInOrder.push(connectorKey);
            }
        }

        // 3) Create users and connector keys; first connector identity becomes owner.
        let ownerUserId = "";
        const userIdByConnectorKey = new Map<string, string>();
        const now = Date.now();
        if (connectorKeysInOrder.length === 0) {
            ownerUserId = createId();
            db.prepare(
                `
          INSERT INTO users (id, is_owner, created_at, updated_at)
          VALUES (?, 1, ?, ?)
        `
            ).run(ownerUserId, now, now);
        } else {
            for (let index = 0; index < connectorKeysInOrder.length; index += 1) {
                const connectorKey = connectorKeysInOrder[index];
                if (!connectorKey) {
                    continue;
                }
                const userId = createId();
                const isOwner = index === 0 ? 1 : 0;
                db.prepare(
                    `
            INSERT INTO users (id, is_owner, created_at, updated_at)
            VALUES (?, ?, ?, ?)
          `
                ).run(userId, isOwner, now, now);
                db.prepare(
                    `
            INSERT INTO user_connector_keys (user_id, connector_key)
            VALUES (?, ?)
          `
                ).run(userId, connectorKey);
                userIdByConnectorKey.set(connectorKey, userId);
                if (isOwner === 1) {
                    ownerUserId = userId;
                }
            }
        }

        // 4) Ensure an owner user always exists.
        const owner = db.prepare("SELECT id FROM users WHERE is_owner = 1 LIMIT 1").get() as
            | { id?: string }
            | undefined;
        ownerUserId = owner?.id ?? ownerUserId;
        if (!ownerUserId) {
            ownerUserId = createId();
            db.prepare(
                `
          INSERT INTO users (id, is_owner, created_at, updated_at)
          VALUES (?, 1, ?, ?)
        `
            ).run(ownerUserId, now, now);
        }

        // 5) Add agents.user_id when missing, defaulting to owner.
        const columns = db.prepare("PRAGMA table_info(agents)").all() as Array<{ name?: string }>;
        const hasUserId = columns.some((column) => column.name === "user_id");
        if (!hasUserId) {
            db.exec(`ALTER TABLE agents ADD COLUMN user_id TEXT NOT NULL DEFAULT '${sqlStringLiteral(ownerUserId)}'`);
        }

        // 6) Backfill user_id by connector mapping and index for lookups.
        for (const [agentId, connectorKey] of connectorKeyByAgentId.entries()) {
            const userId = userIdByConnectorKey.get(connectorKey);
            if (!userId) {
                continue;
            }
            db.prepare("UPDATE agents SET user_id = ? WHERE id = ?").run(userId, agentId);
        }

        db.prepare("UPDATE agents SET user_id = ? WHERE user_id IS NULL").run(ownerUserId);
        db.exec("CREATE INDEX IF NOT EXISTS idx_agents_user_id ON agents(user_id)");
    }
};

function userDescriptorParse(raw: string): ParsedUserDescriptor | null {
    try {
        const parsed = JSON.parse(raw) as { connector?: unknown; userId?: unknown };
        if (typeof parsed.connector !== "string" || typeof parsed.userId !== "string") {
            return null;
        }
        const connector = parsed.connector.trim();
        const userId = parsed.userId.trim();
        if (!connector || !userId) {
            return null;
        }
        return { connector, userId };
    } catch {
        return null;
    }
}

function sqlStringLiteral(value: string): string {
    return value.replaceAll("'", "''");
}
