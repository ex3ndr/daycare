import type { AssistantMessage, Context } from "@mariozechner/pi-ai";
import { describe, expect, it, vi } from "vitest";

import { contextForAgent } from "../engine/agents/context.js";
import { agentHistoryLoad } from "../engine/agents/ops/agentHistoryLoad.js";
import { agentStateRead } from "../engine/agents/ops/agentStateRead.js";
import type { InferenceRouter } from "../engine/modules/inference/router.js";
import { type EvalHarness, evalHarnessCreate } from "./evalHarness.js";
import { evalRun } from "./evalRun.js";

const SAME_TURN_AGENTS_RULE =
    "If a user gives you a durable instruction about how you should work, update `vault://system/agents` in the same turn";
const EXPERIMENT_RULE =
    '- Durable operating rule: When the user says "remember our shipping rule", write it to vault://system/agents before replying.';
const COMPACTION_SUMMARY = "Compacted summary: shipping rule is stored in vault://system/agents before replying.";
const FOLLOW_UP_REPLY = "Our shipping rule is to write it to vault://system/agents before replying.";
const COMPACTION_REQUEST_TEXT = "Summarize the conversation above into a compact context checkpoint.";

describe("evalCompactionExperiment", () => {
    it("keeps the agents vault rule available after manual compaction", async () => {
        const harness = await evalHarnessCreate({
            inferenceRouter: evalCompactionExperimentRouterBuild()
        });

        try {
            const initialTrace = await evalRun(
                {
                    name: "compaction-persistence-experiment",
                    agent: {
                        kind: "agent",
                        path: "compaction-experiment"
                    },
                    turns: [
                        {
                            role: "user",
                            text: "Please remember our shipping rule: remember our shipping rule."
                        }
                    ]
                },
                harness
            );

            const ownerCtx = await harness.agentSystem.ownerCtxEnsure();
            const agentCtx = contextForAgent({ userId: ownerCtx.userId, agentId: initialTrace.agentId });
            const stateBeforeCompaction = await agentStateRead(harness.storage, agentCtx);
            const agentsBodyBeforeCompaction = await agentsDocumentBodyRead(harness);

            expect(initialTrace.turnResults[0]?.result).toEqual({
                type: "message",
                responseText: "Saved that operating rule in vault://system/agents."
            });
            expect(agentsBodyBeforeCompaction).toContain(EXPERIMENT_RULE);

            const compactionResult = await harness.agentSystem.postAndAwait(
                ownerCtx,
                { agentId: initialTrace.agentId },
                { type: "compact", context: {} }
            );
            const stateAfterCompaction = await agentStateRead(harness.storage, agentCtx);
            const historyAfterCompaction = await agentHistoryLoad(harness.storage, agentCtx);
            const agentsBodyAfterCompaction = await agentsDocumentBodyRead(harness);

            expect(compactionResult).toEqual({ type: "compact", ok: true });
            expect(stateBeforeCompaction?.activeSessionId).toBeTruthy();
            expect(stateAfterCompaction?.activeSessionId).toBeTruthy();
            expect(stateAfterCompaction?.activeSessionId).not.toBe(stateBeforeCompaction?.activeSessionId);
            expect(historyAfterCompaction[0]?.type).toBe("user_message");
            if (!historyAfterCompaction[0] || historyAfterCompaction[0].type !== "user_message") {
                throw new Error("Expected compaction summary history record.");
            }
            expect(historyAfterCompaction[0].text).toContain(COMPACTION_SUMMARY);
            expect(agentsBodyAfterCompaction).toContain(EXPERIMENT_RULE);

            const followUpResult = await harness.agentSystem.postAndAwait(
                ownerCtx,
                { agentId: initialTrace.agentId },
                {
                    type: "message",
                    message: { text: "What is our shipping rule?" },
                    context: {}
                }
            );

            expect(followUpResult).toEqual({
                type: "message",
                responseText: FOLLOW_UP_REPLY
            });
        } finally {
            await harness.cleanup();
        }
    });
});

function evalCompactionExperimentRouterBuild(): InferenceRouter {
    return {
        complete: vi.fn(async (context: Context) => {
            const systemPrompt = typeof context.systemPrompt === "string" ? context.systemPrompt : "";
            const messages = context.messages ?? [];
            const lastUserText = userTextLastResolve(messages);
            const sawRunPythonResult = messages.some(
                (message) => message.role === "toolResult" && message.toolName === "run_python"
            );
            const hasCompactionSummary = messages.some(
                (message) =>
                    message.role === "user" &&
                    userMessageTextResolve(message).includes("Compacted summary: shipping rule is stored")
            );

            if (lastUserText.includes(COMPACTION_REQUEST_TEXT)) {
                return inferenceResultBuild(assistantMessageBuild(COMPACTION_SUMMARY));
            }

            if (sawRunPythonResult) {
                return inferenceResultBuild(
                    assistantMessageBuild("Saved that operating rule in vault://system/agents.")
                );
            }

            if (
                systemPrompt.includes(EXPERIMENT_RULE) &&
                hasCompactionSummary &&
                lastUserText.includes("What is our shipping rule?")
            ) {
                return inferenceResultBuild(assistantMessageBuild(FOLLOW_UP_REPLY));
            }

            if (systemPrompt.includes(SAME_TURN_AGENTS_RULE) && lastUserText.includes("remember our shipping rule")) {
                return inferenceResultBuild(
                    assistantToolCallMessageBuild("run-python-1", "run_python", {
                        code: `vault_append(path="vault://system/agents", text='\\n${EXPERIMENT_RULE}\\n')\n"saved"`
                    })
                );
            }

            return inferenceResultBuild(assistantMessageBuild("I lost the shipping rule."));
        })
    } as unknown as InferenceRouter;
}

function assistantMessageBuild(text: string): AssistantMessage {
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

function inferenceResultBuild(message: AssistantMessage) {
    return {
        providerId: "openai",
        modelId: "gpt-4.1",
        message
    };
}

function userTextLastResolve(messages: Context["messages"]): string {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
        const message = messages[index];
        if (message?.role !== "user") {
            continue;
        }
        return userMessageTextResolve(message);
    }
    return "";
}

function userMessageTextResolve(message: Extract<Context["messages"][number], { role: "user" }>): string {
    if (typeof message.content === "string") {
        return message.content;
    }
    if (!Array.isArray(message.content)) {
        return "";
    }
    return message.content
        .filter((part): part is { type: "text"; text: string } => part.type === "text")
        .map((part) => part.text)
        .join("\n");
}

async function agentsDocumentBodyRead(harness: EvalHarness): Promise<string> {
    const ownerCtx = await harness.agentSystem.ownerCtxEnsure();
    const systemRoot = await harness.storage.documents.findBySlugAndParent(ownerCtx, "system", null);
    if (!systemRoot) {
        throw new Error("Missing vault://system root.");
    }
    const agents = await harness.storage.documents.findBySlugAndParent(ownerCtx, "agents", systemRoot.id);
    if (!agents) {
        throw new Error("Missing vault://system/agents.");
    }
    return agents.body;
}
