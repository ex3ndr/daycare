import { describe, expect, it } from "vitest";

import type { SessionPermissions } from "@/types";
import { Storage } from "../../storage/storage.js";
import { Context } from "../agents/context.js";
import { memorySessionObserve } from "./memorySessionObserve.js";

const permissions: SessionPermissions = {
    workingDir: "/workspace",
    writeDirs: ["/workspace"]
};

describe("memorySessionObserve", () => {
    it("runs without error with unprocessed records", async () => {
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
            const sessionId = await storage.sessions.create({ agentId: "agent-1", createdAt: 1000 });
            await storage.history.append(sessionId, { type: "note", at: 1001, text: "msg" });

            const ctx = new Context("agent-1", owner.id);
            const records = await storage.history.findBySessionId(sessionId);

            await expect(memorySessionObserve(1, ctx, records, storage)).resolves.toBeUndefined();
        } finally {
            storage.close();
        }
    });
});
