import type { AssistantMessage, Context } from "@mariozechner/pi-ai";
import { describe, expect, it, vi } from "vitest";

import type { InferenceRouter } from "../engine/modules/inference/router.js";
import { type EvalHarness, evalHarnessCreate } from "./evalHarness.js";
import { evalRun } from "./evalRun.js";

const SAME_TURN_AGENTS_RULE =
    "If a user gives you a durable instruction about how you should work, update `vault://system/agents` in the same turn";
const EXPERIMENT_RULE =
    '- Durable operating rule: When the user says "remember our shipping rule", write it to vault://system/agents before replying.';

describe("evalVaultPersistenceExperiment", () => {
    it("updates vault://system/agents only when the prompt includes same-turn persistence guidance", async () => {
        const control = await evalHarnessCreate({
            inferenceRouter: evalVaultPersistenceExperimentRouterBuild()
        });

        try {
            await agentsDocumentReplace(
                control,
                "Capture durable agent workflow rules in vault://system/agents when they matter."
            );

            const controlTrace = await evalRun(experimentScenarioBuild(), control);
            const controlBody = await agentsDocumentBodyRead(control);

            expect(controlTrace.turnResults[0]?.result).toEqual({
                type: "message",
                responseText: "I will remember that."
            });
            expect(controlBody).not.toContain(EXPERIMENT_RULE);
            expect(
                controlTrace.history.some(
                    (record) => record.type === "rlm_tool_call" && record.toolName === "vault_append"
                )
            ).toBe(false);
        } finally {
            await control.cleanup();
        }

        const treatment = await evalHarnessCreate({
            inferenceRouter: evalVaultPersistenceExperimentRouterBuild()
        });

        try {
            const treatmentBodyBefore = await agentsDocumentBodyRead(treatment);
            expect(treatmentBodyBefore).toContain(SAME_TURN_AGENTS_RULE);

            const treatmentTrace = await evalRun(experimentScenarioBuild(), treatment);
            const treatmentBody = await agentsDocumentBodyRead(treatment);

            expect(treatmentTrace.turnResults[0]?.result).toEqual({
                type: "message",
                responseText: "Saved that operating rule in vault://system/agents."
            });
            expect(treatmentBody).toContain(EXPERIMENT_RULE);
            expect(
                treatmentTrace.history.some(
                    (record) => record.type === "rlm_tool_call" && record.toolName === "vault_append"
                )
            ).toBe(true);
        } finally {
            await treatment.cleanup();
        }
    });
});

function experimentScenarioBuild() {
    return {
        name: "vault-persistence-experiment",
        agent: {
            kind: "agent" as const,
            path: "prompt-experiment"
        },
        turns: [
            {
                role: "user" as const,
                text: "Please remember our shipping rule: remember our shipping rule."
            }
        ]
    };
}

function evalVaultPersistenceExperimentRouterBuild(): InferenceRouter {
    return {
        complete: vi.fn(async (context: Context) => {
            const systemPrompt = typeof context.systemPrompt === "string" ? context.systemPrompt : "";
            const messages = context.messages ?? [];
            const sawRunPythonResult = messages.some(
                (message) => message.role === "toolResult" && message.toolName === "run_python"
            );

            if (sawRunPythonResult) {
                return inferenceResultBuild(
                    assistantMessageBuild("Saved that operating rule in vault://system/agents.")
                );
            }

            if (
                systemPrompt.includes(SAME_TURN_AGENTS_RULE) &&
                userTextLastResolve(messages).includes("remember our shipping rule")
            ) {
                return inferenceResultBuild(
                    assistantToolCallMessageBuild("run-python-1", "run_python", {
                        code: `vault_append(path="vault://system/agents", text='\\n${EXPERIMENT_RULE}\\n')\n"saved"`
                    })
                );
            }

            return inferenceResultBuild(assistantMessageBuild("I will remember that."));
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
        if (typeof message.content === "string") {
            return message.content;
        }
        if (Array.isArray(message.content)) {
            return message.content
                .filter((part): part is { type: "text"; text: string } => part.type === "text")
                .map((part) => part.text)
                .join("\n");
        }
    }
    return "";
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

async function agentsDocumentReplace(harness: EvalHarness, replacementLine: string): Promise<void> {
    const ownerCtx = await harness.agentSystem.ownerCtxEnsure();
    const systemRoot = await harness.storage.documents.findBySlugAndParent(ownerCtx, "system", null);
    if (!systemRoot) {
        throw new Error("Missing vault://system root.");
    }
    const agents = await harness.storage.documents.findBySlugAndParent(ownerCtx, "agents", systemRoot.id);
    if (!agents) {
        throw new Error("Missing vault://system/agents.");
    }
    if (!agents.body.includes(SAME_TURN_AGENTS_RULE)) {
        throw new Error("Expected bundled agents prompt to include same-turn vault guidance.");
    }

    await harness.storage.documents.update(ownerCtx, agents.id, {
        body: agents.body.replace(SAME_TURN_AGENTS_RULE, replacementLine),
        updatedAt: Date.now()
    });
}
