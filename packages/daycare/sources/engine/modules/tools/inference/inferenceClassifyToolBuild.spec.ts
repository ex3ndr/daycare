import type { AssistantMessage } from "@mariozechner/pi-ai";
import { describe, expect, it, vi } from "vitest";
import type { ToolExecutionContext } from "@/types";
import { configResolve } from "../../../../config/configResolve.js";
import type { ProviderSettings } from "../../../../settings.js";
import { ConfigModule } from "../../../config/configModule.js";
import type { InferenceRouter } from "../../inference/router.js";
import { inferenceClassifyToolBuild } from "./inferenceClassifyToolBuild.js";
import { inferenceResolveProviders } from "./inferenceResolveProviders.js";

describe("inferenceClassifyToolBuild", () => {
    it("builds the expected tool definition", () => {
        const config = configModuleBuild([{ id: "openai", enabled: true, model: "gpt-4o-mini" }]);
        const tool = inferenceClassifyToolBuild({} as InferenceRouter, config);

        expect(tool.tool.name).toBe("inference_classify");
        expect(tool.tool.description).toContain("Classify text");
    });

    it("executes inference and returns parsed classify output", async () => {
        const config = configModuleBuild([
            { id: "openai", enabled: true, model: "gpt-4o-mini" },
            { id: "anthropic", enabled: true, model: "claude-sonnet-4-5" }
        ]);
        const complete = vi.fn(async () => ({
            message: assistantMessageBuild(
                "<summary>The customer reports a billing issue and requests help.</summary><class>support</class>"
            ),
            providerId: "openai",
            modelId: "custom-model-id"
        }));
        const inferenceRouter = { complete } as unknown as InferenceRouter;
        const tool = inferenceClassifyToolBuild(inferenceRouter, config);

        const result = await tool.execute(
            {
                text: "I was charged twice and need this fixed.",
                variants: [
                    { class: "sales", description: "Pre-sales and product interest." },
                    { class: "support", description: "Requests for help, troubleshooting, or incidents." }
                ],
                model: "custom-model-id"
            },
            contextBuild(),
            { id: "call-1", name: "inference_classify" }
        );

        expect(result.typedResult).toEqual({
            summary: "The customer reports a billing issue and requests help.",
            class: "support"
        });
        expect(result.toolMessage.content).toEqual([
            {
                type: "text",
                text: "The customer reports a billing issue and requests help.\nClass: support"
            }
        ]);
        expect(complete).toHaveBeenCalledTimes(1);
        expect(complete).toHaveBeenCalledWith(
            expect.objectContaining({
                systemPrompt: expect.stringContaining("Categories:"),
                messages: [
                    expect.objectContaining({ role: "user", content: "I was charged twice and need this fixed." })
                ]
            }),
            expect.stringMatching(/^tool:inference_classify:/),
            { providersOverride: inferenceResolveProviders(config, "custom-model-id") }
        );
    });
});

function configModuleBuild(providers: ProviderSettings[]): ConfigModule {
    const config = configResolve(
        {
            engine: { dataDir: "/tmp/daycare-tests" },
            providers
        },
        "/tmp/daycare-tests/settings.json"
    );
    return new ConfigModule(config);
}

function contextBuild(): ToolExecutionContext {
    return {
        connectorRegistry: null as unknown as ToolExecutionContext["connectorRegistry"],
        sandbox: null as unknown as ToolExecutionContext["sandbox"],
        auth: null as unknown as ToolExecutionContext["auth"],
        logger: console as unknown as ToolExecutionContext["logger"],
        assistant: null,
        agent: { id: "agent-1", descriptor: { type: "user" } } as unknown as ToolExecutionContext["agent"],
        ctx: { userId: "user-1", agentId: "agent-1" } as unknown as ToolExecutionContext["ctx"],
        source: "test",
        messageContext: {},
        agentSystem: null as unknown as ToolExecutionContext["agentSystem"],
        heartbeats: null as unknown as ToolExecutionContext["heartbeats"]
    };
}

function assistantMessageBuild(text: string): AssistantMessage {
    return {
        role: "assistant",
        content: [{ type: "text", text }],
        stopReason: "complete",
        usage: {
            input: 0,
            output: 0,
            cacheRead: 0,
            cacheWrite: 0,
            total: 0
        }
    } as unknown as AssistantMessage;
}
