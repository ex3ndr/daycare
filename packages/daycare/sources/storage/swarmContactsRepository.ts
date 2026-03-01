import { and, desc, eq, sql } from "drizzle-orm";
import type { DaycareDb } from "../schema.js";
import { swarmContactsTable } from "../schema.js";
import type { SwarmContactDbRecord } from "./databaseTypes.js";

/**
 * Swarm contacts repository backed by Drizzle.
 * Expects: schema migrations already applied for swarm_contacts.
 */
export class SwarmContactsRepository {
    private readonly db: DaycareDb;

    constructor(db: DaycareDb) {
        this.db = db;
    }

    async findOrCreate(
        swarmUserId: string,
        contactAgentId: string,
        swarmAgentId: string
    ): Promise<SwarmContactDbRecord> {
        const existing = await this.find(swarmUserId, contactAgentId);
        if (existing) {
            if (existing.swarmAgentId !== swarmAgentId) {
                await this.db
                    .update(swarmContactsTable)
                    .set({ swarmAgentId, lastContactAt: Date.now() })
                    .where(
                        and(
                            eq(swarmContactsTable.swarmUserId, swarmUserId),
                            eq(swarmContactsTable.contactAgentId, contactAgentId)
                        )
                    );
                const refreshed = await this.find(swarmUserId, contactAgentId);
                if (refreshed) {
                    return refreshed;
                }
            }
            return existing;
        }

        const now = Date.now();
        try {
            await this.db.insert(swarmContactsTable).values({
                swarmUserId,
                contactAgentId,
                swarmAgentId,
                messagesSent: 0,
                messagesReceived: 0,
                firstContactAt: now,
                lastContactAt: now
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error ?? "");
            if (!message.includes("duplicate key")) {
                throw error;
            }
        }

        const created = await this.find(swarmUserId, contactAgentId);
        if (!created) {
            throw new Error("Failed to create swarm contact record.");
        }
        return created;
    }

    async recordSent(swarmUserId: string, contactAgentId: string): Promise<void> {
        const updated = await this.db
            .update(swarmContactsTable)
            .set({
                messagesSent: sql`${swarmContactsTable.messagesSent} + 1`,
                lastContactAt: Date.now()
            })
            .where(
                and(
                    eq(swarmContactsTable.swarmUserId, swarmUserId),
                    eq(swarmContactsTable.contactAgentId, contactAgentId)
                )
            )
            .returning({ swarmUserId: swarmContactsTable.swarmUserId });
        if (updated.length === 0) {
            throw new Error("Swarm contact not found.");
        }
    }

    async recordReceived(swarmUserId: string, contactAgentId: string): Promise<void> {
        const updated = await this.db
            .update(swarmContactsTable)
            .set({
                messagesReceived: sql`${swarmContactsTable.messagesReceived} + 1`,
                lastContactAt: Date.now()
            })
            .where(
                and(
                    eq(swarmContactsTable.swarmUserId, swarmUserId),
                    eq(swarmContactsTable.contactAgentId, contactAgentId)
                )
            )
            .returning({ swarmUserId: swarmContactsTable.swarmUserId });
        if (updated.length === 0) {
            throw new Error("Swarm contact not found.");
        }
    }

    async listContacts(swarmUserId: string): Promise<SwarmContactDbRecord[]> {
        const rows = await this.db
            .select()
            .from(swarmContactsTable)
            .where(eq(swarmContactsTable.swarmUserId, swarmUserId))
            .orderBy(desc(swarmContactsTable.lastContactAt));
        return rows.map((row) => swarmContactParse(row));
    }

    async isKnownContact(swarmUserId: string, contactAgentId: string): Promise<boolean> {
        const rows = await this.db
            .select({ swarmUserId: swarmContactsTable.swarmUserId })
            .from(swarmContactsTable)
            .where(
                and(
                    eq(swarmContactsTable.swarmUserId, swarmUserId),
                    eq(swarmContactsTable.contactAgentId, contactAgentId)
                )
            )
            .limit(1);
        return rows.length > 0;
    }

    private async find(swarmUserId: string, contactAgentId: string): Promise<SwarmContactDbRecord | null> {
        const rows = await this.db
            .select()
            .from(swarmContactsTable)
            .where(
                and(
                    eq(swarmContactsTable.swarmUserId, swarmUserId),
                    eq(swarmContactsTable.contactAgentId, contactAgentId)
                )
            )
            .limit(1);
        const row = rows[0];
        if (!row) {
            return null;
        }
        return swarmContactParse(row);
    }
}

function swarmContactParse(row: {
    swarmUserId: string;
    contactAgentId: string;
    swarmAgentId: string;
    messagesSent: number;
    messagesReceived: number;
    firstContactAt: number;
    lastContactAt: number;
}): SwarmContactDbRecord {
    return {
        swarmUserId: row.swarmUserId,
        contactAgentId: row.contactAgentId,
        swarmAgentId: row.swarmAgentId,
        messagesSent: row.messagesSent,
        messagesReceived: row.messagesReceived,
        firstContactAt: row.firstContactAt,
        lastContactAt: row.lastContactAt
    };
}
