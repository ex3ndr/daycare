import { describe, expect, it, vi } from "vitest";

import type { SessionPermissions } from "@/types";
import { Storage } from "../../storage/storage.js";
import { Context } from "../agents/context.js";
import type { InferenceRouter } from "../modules/inference/router.js";
import { memorySessionObserve } from "./memorySessionObserve.js";

const permissions: SessionPermissions = {
    workingDir: "/workspace",
    writeDirs: ["/workspace"]
};

function mockInferenceRouter(responseText: string): InferenceRouter {
    return {
        complete: vi.fn().mockResolvedValue({
            message: {
                role: "assistant",
                content: [{ type: "text", text: responseText }],
                api: "test",
                provider: "test",
                model: "test",
                usage: {
                    input: 0,
                    output: 0,
                    cacheRead: 0,
                    cacheWrite: 0,
                    totalTokens: 0,
                    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 }
                },
                stopReason: "stop",
                timestamp: Date.now()
            },
            providerId: "test",
            modelId: "test"
        }),
        reload: vi.fn()
    } as unknown as InferenceRouter;
}

describe("memorySessionObserve", () => {
    it("returns observations from inference", async () => {
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
            await storage.history.append(sessionId, {
                type: "user_message",
                at: 1001,
                text: "Deploy to production",
                files: []
            });

            const ctx = new Context("agent-1", owner.id);
            const records = await storage.history.findBySessionId(sessionId);
            const xml = "<observations>\n<observation>User requested production deploy</observation>\n</observations>";
            const router = mockInferenceRouter(xml);

            const observations = await memorySessionObserve({
                sessionNumber: 1,
                ctx,
                records,
                storage,
                inferenceRouter: router,
                providers: []
            });

            expect(observations).toEqual([{ content: "User requested production deploy" }]);
            expect(router.complete).toHaveBeenCalledOnce();
        } finally {
            storage.close();
        }
    });

    it("returns empty array when no records", async () => {
        const storage = Storage.open(":memory:");
        try {
            const owner = (await storage.users.findMany())[0];
            if (!owner) {
                throw new Error("Owner user missing");
            }
            const ctx = new Context("agent-1", owner.id);
            const router = mockInferenceRouter("<observations></observations>");

            const observations = await memorySessionObserve({
                sessionNumber: 1,
                ctx,
                records: [],
                storage,
                inferenceRouter: router,
                providers: []
            });

            expect(observations).toEqual([]);
            expect(router.complete).not.toHaveBeenCalled();
        } finally {
            storage.close();
        }
    });
});
