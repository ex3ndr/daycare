import { describe, expect, it } from "vitest";

import { databaseOpenTest } from "./databaseOpenTest.js";
import { InboxRepository } from "./inboxRepository.js";

describe("InboxRepository", () => {
    it("supports insert, ordered lookup, and delete operations", async () => {
        const db = databaseOpenTest();
        try {
            schemaCreate(db);
            const repository = new InboxRepository(db);

            await repository.insert("inbox-2", "agent-a", 20, "reset", '{"type":"reset"}');
            await repository.insert("inbox-1", "agent-a", 10, "message", '{"type":"message"}');
            await repository.insert("inbox-3", "agent-b", 30, "signal", '{"type":"signal"}');

            const byAgent = await repository.findByAgentId("agent-a");
            expect(byAgent.map((entry) => entry.id)).toEqual(["inbox-1", "inbox-2"]);
            expect(byAgent.map((entry) => entry.postedAt)).toEqual([10, 20]);

            await repository.delete("inbox-1");
            const afterDelete = await repository.findByAgentId("agent-a");
            expect(afterDelete.map((entry) => entry.id)).toEqual(["inbox-2"]);

            await repository.deleteByAgentId("agent-a");
            const finalRows = await repository.findByAgentId("agent-a");
            expect(finalRows).toEqual([]);
        } finally {
            db.close();
        }
    });
});

function schemaCreate(db: ReturnType<typeof databaseOpenTest>): void {
    db.exec(`
        CREATE TABLE inbox (
            id TEXT PRIMARY KEY,
            agent_id TEXT NOT NULL,
            posted_at INTEGER NOT NULL,
            type TEXT NOT NULL,
            data TEXT NOT NULL
        );

        CREATE INDEX idx_inbox_agent_order
            ON inbox(agent_id, posted_at);
    `);
}
