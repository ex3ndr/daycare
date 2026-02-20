import { describe, expect, it } from "vitest";

import type { SessionPermissions } from "@/types";
import { HistoryRepository } from "./historyRepository.js";
import { Storage } from "./storage.js";

const permissions: SessionPermissions = {
    workspaceDir: "/workspace",
    workingDir: "/workspace",
    writeDirs: ["/workspace"],
    readDirs: ["/workspace"],
    network: false,
    events: false
};

describe("HistoryRepository", () => {
    it("appends and finds by session and agent", async () => {
        const storage = Storage.open(":memory:");
        try {
            const owner = (await storage.users.findMany())[0];
            if (!owner) {
                throw new Error("Owner user missing");
            }
            await storage.agents.create({
                id: "agent-1",
                userId: owner.id,
                type: "cron",
                descriptor: { type: "cron", id: "agent-1", name: "job" },
                activeSessionId: null,
                permissions,
                tokens: null,
                stats: {},
                lifecycle: "active",
                createdAt: 1,
                updatedAt: 1
            });

            const sessionA = await storage.sessions.create({ agentId: "agent-1", createdAt: 10 });
            const sessionB = await storage.sessions.create({ agentId: "agent-1", createdAt: 20 });
            const history = new HistoryRepository(storage.db);

            await history.append(sessionA, { type: "note", at: 11, text: "A1" });
            await history.append(sessionB, { type: "note", at: 21, text: "B1" });

            const bySession = await history.findBySessionId(sessionA);
            expect(bySession).toEqual([{ type: "note", at: 11, text: "A1" }]);

            const byAgent = await history.findByAgentId("agent-1");
            expect(byAgent).toEqual([
                { type: "note", at: 11, text: "A1" },
                { type: "note", at: 21, text: "B1" }
            ]);
        } finally {
            storage.close();
        }
    });
});
