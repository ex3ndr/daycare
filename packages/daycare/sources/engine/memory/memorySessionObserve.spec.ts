import { describe, expect, it, vi } from "vitest";

import type { SessionPermissions } from "@/types";
import { storageOpenTest } from "../../storage/storageOpenTest.js";
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
        const storage = await storageOpenTest();
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

            const ctx = new Context({ userId: owner.id, agentId: "agent-1" });
            const records = await storage.history.findBySessionId(sessionId);
            const xml =
                "<observations>\n<observation><text>The person wanted to push their latest changes to production as part of the release cycle</text><context>During a release planning session, the person asked to deploy to production. They seemed confident the changes were ready and wanted to move forward quickly.</context></observation>\n</observations>";
            const router = mockInferenceRouter(xml);

            const observations = await memorySessionObserve({
                sessionNumber: 1,
                ctx,
                records,
                storage,
                inferenceRouter: router,
                providers: []
            });

            expect(observations).toEqual([
                {
                    text: "The person wanted to push their latest changes to production as part of the release cycle",
                    context:
                        "During a release planning session, the person asked to deploy to production. They seemed confident the changes were ready and wanted to move forward quickly."
                }
            ]);
            expect(router.complete).toHaveBeenCalledOnce();
        } finally {
            storage.connection.close();
        }
    });

    it("passes isForeground to inferObservations and uses background labels", async () => {
        const storage = await storageOpenTest();
        try {
            const owner = (await storage.users.findMany())[0];
            if (!owner) {
                throw new Error("Owner user missing");
            }
            await storage.agents.create({
                id: "agent-bg",
                userId: owner.id,
                type: "cron",
                descriptor: { type: "cron", id: "agent-bg", name: "job" },
                activeSessionId: null,
                permissions,
                tokens: null,
                lifecycle: "active",
                createdAt: 1,
                updatedAt: 1
            });
            const sessionId = await storage.sessions.create({ agentId: "agent-bg", createdAt: 1000 });
            await storage.history.append(sessionId, {
                type: "user_message",
                at: 1001,
                text: "run cleanup",
                files: []
            });

            const ctx = new Context({ userId: owner.id, agentId: "agent-bg" });
            const records = await storage.history.findBySessionId(sessionId);
            const xml = "<observations></observations>";
            const router = mockInferenceRouter(xml);

            await memorySessionObserve({
                sessionNumber: 1,
                ctx,
                records,
                storage,
                inferenceRouter: router,
                providers: [],
                isForeground: false
            });

            // Verify the transcript sent to inference uses background labels
            const calls = (router.complete as ReturnType<typeof vi.fn>).mock.calls;
            expect(calls.length).toBeGreaterThan(0);
            const context = calls[0]![0] as { messages: { content: string }[]; systemPrompt: string };
            expect(context.messages[0]!.content).toContain("## System Message");
            expect(context.messages[0]!.content).not.toContain("## User");
            // Verify the system prompt uses the background variant
            expect(context.systemPrompt).toContain("automated agent");
            expect(context.systemPrompt).not.toContain("between a person and an AI assistant");
        } finally {
            storage.connection.close();
        }
    });

    it("returns empty array when no records", async () => {
        const storage = await storageOpenTest();
        try {
            const owner = (await storage.users.findMany())[0];
            if (!owner) {
                throw new Error("Owner user missing");
            }
            const ctx = new Context({ userId: owner.id, agentId: "agent-1" });
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
            storage.connection.close();
        }
    });
});
