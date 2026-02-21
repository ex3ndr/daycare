import { describe, expect, it } from "vitest";

import type { SessionPermissions } from "@/types";
import { SessionsRepository } from "./sessionsRepository.js";
import { Storage } from "./storage.js";

const permissions: SessionPermissions = {
    workingDir: "/workspace",
    writeDirs: ["/workspace"]
};

describe("SessionsRepository", () => {
    it("creates and finds sessions", async () => {
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

            const sessions = new SessionsRepository(storage.db);
            const sessionId = await sessions.create({
                agentId: "agent-1",
                inferenceSessionId: "infer-1",
                createdAt: 5,
                resetMessage: "manual"
            });

            const byId = await sessions.findById(sessionId);
            expect(byId).toEqual({
                id: sessionId,
                agentId: "agent-1",
                inferenceSessionId: "infer-1",
                createdAt: 5,
                resetMessage: "manual"
            });

            await sessions.create({ agentId: "agent-1", createdAt: 8 });
            const listed = await sessions.findByAgentId("agent-1");
            expect(listed).toHaveLength(2);
            expect(listed[0]?.createdAt).toBe(5);
            expect(listed[1]?.createdAt).toBe(8);
        } finally {
            storage.close();
        }
    });
});
