import type { AssistantMessage, Context } from "@mariozechner/pi-ai";

import type { InferenceRouter } from "../engine/modules/inference/router.js";
import type { EvalInferenceBranch, EvalScenario } from "./evalScenario.js";

/**
 * Builds a deterministic mock inference router from scenario-defined scripted responses.
 * Expects: scenario.inference is omitted or uses the validated `type: "scripted"` format.
 */
export function evalInferenceRouterScenarioBuild(scenario: EvalScenario): InferenceRouter | null {
    const inference = scenario.inference;
    if (!inference) {
        return null;
    }

    let callIndex = 0;

    return {
        complete: async (context: Context) => {
            const call = inference.calls[callIndex];
            if (!call) {
                throw new Error(`Scripted eval inference exhausted at call ${callIndex + 1}.`);
            }
            callIndex += 1;

            const branch = evalInferenceBranchResolve(call.branches, context.systemPrompt);
            if (!branch) {
                throw new Error(`No scripted inference branch matched at call ${callIndex}.`);
            }

            return {
                providerId: "openai",
                modelId: "gpt-4.1",
                message: branch.toolCall
                    ? evalAssistantToolCallMessageBuild(
                          branch.toolCall.id,
                          branch.toolCall.name,
                          branch.toolCall.arguments
                      )
                    : evalAssistantTextMessageBuild(branch.message ?? "ok")
            };
        }
    } as unknown as InferenceRouter;
}

function evalInferenceBranchResolve(
    branches: EvalInferenceBranch[],
    systemPromptValue: Context["systemPrompt"]
): EvalInferenceBranch | null {
    const systemPrompt = typeof systemPromptValue === "string" ? systemPromptValue : "";

    for (const branch of branches) {
        if (
            !branch.whenSystemPromptIncludes ||
            branch.whenSystemPromptIncludes.every((value) => systemPrompt.includes(value))
        ) {
            return branch;
        }
    }

    return null;
}

function evalAssistantTextMessageBuild(text: string): AssistantMessage {
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

function evalAssistantToolCallMessageBuild(
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
