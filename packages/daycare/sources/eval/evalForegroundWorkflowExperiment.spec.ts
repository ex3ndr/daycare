import type { AssistantMessage, Context } from "@mariozechner/pi-ai";
import { describe, expect, it } from "vitest";

import type { InferenceRouter } from "../engine/modules/inference/router.js";
import { evalHarnessCreate } from "./evalHarness.js";
import { evalRun } from "./evalRun.js";

const USER_REQUEST =
    "Please set up a reusable workflow for frontend QA triage. Reuse an existing workflow if one already fits.";

describe("evalForegroundWorkflowExperiment", () => {
    it("nudges foreground agents to reuse or create workflows instead of staying inline", async () => {
        const routeDecisions: string[] = [];
        const harness = await evalHarnessCreate({
            inferenceRouter: foregroundWorkflowExperimentRouterBuild(routeDecisions)
        });

        try {
            const trace = await evalRun(
                {
                    name: "foreground-workflow-experiment",
                    agent: {
                        kind: "connector",
                        path: "telegram"
                    },
                    turns: [{ role: "user", text: USER_REQUEST }]
                },
                harness
            );

            expect(routeDecisions).toEqual(["topology", "task_create", "final"]);
            expect(trace.turnResults[0]?.result).toEqual({
                type: "message",
                responseText: "Created a reusable QA triage workflow after checking for an existing fit."
            });
        } finally {
            await harness.cleanup();
        }
    });
});

function foregroundWorkflowExperimentRouterBuild(routeDecisions: string[]): InferenceRouter {
    let stage: "initial" | "after_topology" | "after_task_create" = "initial";

    return {
        complete: async (context: Context) => {
            const systemPrompt = typeof context.systemPrompt === "string" ? context.systemPrompt : "";

            if (stage === "after_task_create") {
                routeDecisions.push("final");
                return inferenceResultBuild(
                    assistantTextMessageBuild(
                        "Created a reusable QA triage workflow after checking for an existing fit."
                    )
                );
            }

            if (stage === "after_topology") {
                stage = "after_task_create";
                routeDecisions.push("task_create");
                return inferenceResultBuild(
                    assistantToolCallMessageBuild("tool-2", "task_create", {
                        title: "Frontend QA triage",
                        code: "print('Review new frontend QA issues and summarize blockers.')",
                        description: "Reusable workflow for frontend QA triage."
                    })
                );
            }

            if (
                systemPrompt.includes("workflow-first") &&
                systemPrompt.includes("reuse an existing workflow") &&
                systemPrompt.includes("create a custom workflow")
            ) {
                stage = "after_topology";
                routeDecisions.push("topology");
                return inferenceResultBuild(assistantToolCallMessageBuild("tool-1", "topology", {}));
            }

            return inferenceResultBuild(
                assistantTextMessageBuild(
                    "I can handle this inline, but I am not being pushed strongly enough toward workflows yet."
                )
            );
        }
    } as unknown as InferenceRouter;
}

function inferenceResultBuild(message: AssistantMessage) {
    return {
        providerId: "openai",
        modelId: "gpt-4.1",
        message
    };
}

function assistantTextMessageBuild(text: string): AssistantMessage {
    return {
        role: "assistant",
        content: [{ type: "text", text }],
        api: "openai-responses",
        provider: "openai",
        model: "gpt-4.1",
        usage: {
            input: 10,
            output: 5,
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: 15,
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

function assistantToolCallMessageBuild(
    toolCallId: string,
    toolName: string,
    argumentsValue: Record<string, unknown>
): AssistantMessage {
    return {
        role: "assistant",
        content: [{ id: toolCallId, name: toolName, type: "toolCall", arguments: argumentsValue }],
        api: "openai-responses",
        provider: "openai",
        model: "gpt-4.1",
        usage: {
            input: 10,
            output: 5,
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: 15,
            cost: {
                input: 0,
                output: 0,
                cacheRead: 0,
                cacheWrite: 0,
                total: 0
            }
        },
        stopReason: "toolUse",
        timestamp: Date.now()
    };
}
