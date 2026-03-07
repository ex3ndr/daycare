import type { AssistantMessage, Context } from "@mariozechner/pi-ai";
import { describe, expect, it, vi } from "vitest";

import { configResolve } from "../../../config/configResolve.js";
import { ConfigModule } from "../../config/configModule.js";
import { InferenceRouter } from "./router.js";

describe("InferenceRouter", () => {
    it("passes configured provider reasoning into runtime options", async () => {
        const complete = vi.fn(async (_context: Context, options?: Record<string, unknown>) => {
            expect(options).toMatchObject({
                reasoning: "high",
                sessionId: "session-1"
            });
            return messageBuild();
        });

        const router = new InferenceRouter({
            registry: {
                get: () => ({
                    createClient: async () => ({
                        modelId: "gpt-5",
                        complete,
                        stream: vi.fn()
                    })
                })
            } as never,
            auth: {} as never,
            config: configModuleBuild([
                {
                    id: "openai",
                    enabled: true,
                    model: "gpt-5",
                    reasoning: "high"
                }
            ])
        });

        await router.complete(
            {
                messages: [{ role: "user", content: [{ type: "text", text: "hello" }], timestamp: Date.now() }]
            },
            "session-1"
        );

        expect(complete).toHaveBeenCalledTimes(1);
    });
});

function configModuleBuild(providers: Array<{ id: string; enabled: boolean; model: string; reasoning?: "high" }>) {
    return new ConfigModule(
        configResolve(
            {
                engine: { dataDir: "/tmp/daycare-router-tests" },
                providers
            },
            "/tmp/daycare-router-tests/settings.json"
        )
    );
}

function messageBuild(): AssistantMessage {
    return {
        role: "assistant",
        content: [{ type: "text", text: "ok" }],
        api: "openai-responses",
        provider: "openai",
        model: "gpt-5",
        usage: {
            input: 1,
            output: 1,
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: 2,
            cost: {
                input: 0,
                output: 0,
                cacheRead: 0,
                cacheWrite: 0,
                total: 0
            }
        },
        stopReason: "stop",
        timestamp: Date.now()
    };
}
