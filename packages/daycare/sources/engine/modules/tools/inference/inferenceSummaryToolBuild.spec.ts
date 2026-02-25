import type { AssistantMessage } from "@mariozechner/pi-ai";
import { describe, expect, it, vi } from "vitest";
import type { ToolExecutionContext } from "@/types";
import { configResolve } from "../../../../config/configResolve.js";
import type { ProviderSettings } from "../../../../settings.js";
import { ConfigModule } from "../../../config/configModule.js";
import type { InferenceRouter } from "../../inference/router.js";
import { inferenceResolveProviders } from "./inferenceResolveProviders.js";
import { inferenceSummaryToolBuild } from "./inferenceSummaryToolBuild.js";

describe("inferenceSummaryToolBuild", () => {
    it("builds the expected tool definition", () => {
        const config = configModuleBuild([{ id: "openai", enabled: true, model: "gpt-4o-mini" }]);
        const tool = inferenceSummaryToolBuild({} as InferenceRouter, config);

        expect(tool.tool.name).toBe("inference_summary");
        expect(tool.tool.description).toContain("Summarize a piece of text");
    });

    it("executes inference and returns parsed summary output", async () => {
        const config = configModuleBuild([
            { id: "openai", enabled: true, model: "gpt-4o-mini" },
            { id: "anthropic", enabled: true, model: "claude-sonnet-4-5" }
        ]);
        const complete = vi.fn(async () => ({
            message: assistantMessageBuild("<summary>Concise summary text.</summary>"),
            providerId: "openai",
            modelId: "gpt-4o-mini"
        }));
        const inferenceRouter = { complete } as unknown as InferenceRouter;
        const tool = inferenceSummaryToolBuild(inferenceRouter, config);

        const result = await tool.execute({ text: "Long source text", model: "small" }, contextBuild(), {
            id: "call-1",
            name: "inference_summary"
        });

        expect(result.typedResult).toEqual({ summary: "Concise summary text." });
        expect(result.toolMessage.content).toEqual([{ type: "text", text: "Concise summary text." }]);
        expect(complete).toHaveBeenCalledTimes(1);
        expect(complete).toHaveBeenCalledWith(
            expect.objectContaining({
                systemPrompt: expect.stringContaining("<summary>"),
                messages: [expect.objectContaining({ role: "user", content: "Long source text" })]
            }),
            expect.stringMatching(/^tool:inference_summary:/),
            { providersOverride: inferenceResolveProviders(config, "small") }
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
