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
                task: "Classify support intent",
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
                systemPrompt: expect.stringContaining("<class>exact_category_name</class>"),
                messages: [
                    expect.objectContaining({
                        role: "user",
                        content:
                            "<task>\nClassify support intent\n</task>\n\n<categories>\n- sales: Pre-sales and product interest.\n- support: Requests for help, troubleshooting, or incidents.\n</categories>\n\n<text>\nI was charged twice and need this fixed.\n</text>"
                    })
                ]
            }),
            expect.stringMatching(/^tool:inference_classify:/),
            { providersOverride: inferenceResolveProviders(config, "custom-model-id") }
        );
    });

    it("stringifies non-string task, text, and variants", async () => {
        const config = configModuleBuild([{ id: "openai", enabled: true, model: "gpt-4o-mini" }]);
        const complete = vi.fn(async () => ({
            message: assistantMessageBuild("<summary>Payload matches class one.</summary><class>1</class>"),
            providerId: "openai",
            modelId: "gpt-4o-mini"
        }));
        const inferenceRouter = { complete } as unknown as InferenceRouter;
        const tool = inferenceClassifyToolBuild(inferenceRouter, config);

        const result = await tool.execute(
            {
                task: { mode: "classify" },
                text: { value: 7 },
                variants: [{ class: 1, description: { label: "first" } }]
            },
            contextBuild(),
            { id: "call-2", name: "inference_classify" }
        );

        expect(result.typedResult).toEqual({ summary: "Payload matches class one.", class: "1" });
        expect(complete).toHaveBeenCalledWith(
            expect.objectContaining({
                messages: [
                    expect.objectContaining({
                        content:
                            '<task>\n{"mode":"classify"}\n</task>\n\n<categories>\n- 1: {"label":"first"}\n</categories>\n\n<text>\n{"value":7}\n</text>'
                    })
                ]
            }),
            expect.any(String),
            expect.any(Object)
        );
    });

    it("throws when task is missing", async () => {
        const config = configModuleBuild([{ id: "openai", enabled: true, model: "gpt-4o-mini" }]);
        const inferenceRouter = { complete: vi.fn() } as unknown as InferenceRouter;
        const tool = inferenceClassifyToolBuild(inferenceRouter, config);

        await expect(
            tool.execute(
                {
                    task: "   ",
                    text: "abc",
                    variants: [{ class: "sales", description: "desc" }]
                },
                contextBuild(),
                { id: "call-3", name: "inference_classify" }
            )
        ).rejects.toThrow("task is required.");
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
        agentSystem: null as unknown as ToolExecutionContext["agentSystem"]
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
