import type { Api, Context, Model, ToolCall } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";

import { promptInput } from "../commands/prompts.js";
import { recipeAnthropicApiKeyResolve } from "./utils/recipeAnthropicApiKeyResolve.js";
import { recipeAnthropicModelResolve } from "./utils/recipeAnthropicModelResolve.js";
import { recipeAnthropicReplyGet } from "./utils/recipeAnthropicReplyGet.js";
import { recipeAuthPathResolve } from "./utils/recipeAuthPathResolve.js";
import {
    type RecipePythonExecutionResult,
    type RecipePythonRepl,
    recipePythonReplCreate
} from "./utils/recipePythonReplCreate.js";
import { recipePythonSystemPromptBuild } from "./utils/recipePythonSystemPromptBuild.js";

const DEFAULT_MODEL = "claude-sonnet-4-5";
const DEFAULT_SANDBOX_NAME = "pyrepl";
const MAX_INTERNAL_STEPS = 6;
const RECIPE_PYREPL_TOOLS: NonNullable<Context["tools"]> = [
    {
        name: "python_exec",
        description: "Execute Python code in the persistent recipe REPL sandbox.",
        parameters: Type.Object(
            {
                code: Type.String({
                    description: "Python code to execute."
                })
            },
            { additionalProperties: false }
        )
    },
    {
        name: "output_string",
        description: "Emit the final user-facing response string for this turn.",
        parameters: Type.Object(
            {
                output: Type.String({
                    description: "Final response text."
                })
            },
            { additionalProperties: false }
        )
    }
];
const USER_PROMPT_READY_MESSAGE =
    "A new prompt is available in Python variable `userPrompt`. Continue with tool calls only.";
const PROTOCOL_RETRY_MESSAGE =
    "Protocol violation: respond with tool calls only. Use `python_exec` or `output_string`.";

/**
 * Runs a sequential inference loop where the model uses python_exec/output_string tool calls.
 * Expects: Anthropic auth is configured and system python is available.
 */
export async function main(args: string[]): Promise<void> {
    const modelId = args[0]?.trim() || process.env.DAYCARE_RECIPE_MODEL?.trim() || DEFAULT_MODEL;
    const sandboxName = args[1]?.trim() || DEFAULT_SANDBOX_NAME;
    const model = recipeAnthropicModelResolve(modelId);
    const authPath = recipeAuthPathResolve();
    const messages: Context["messages"] = [];
    const repl = await recipePythonReplCreate(sandboxName);
    const systemPrompt = recipePythonSystemPromptBuild(repl.sandboxDir);

    console.log("Recipe pyrepl started.");
    console.log(`Sandbox directory: ${repl.sandboxDir}`);
    console.log("Type /exit to quit.\n");

    try {
        while (true) {
            const userInput = await promptInput({
                message: "You",
                placeholder: "Type your message"
            });
            if (userInput === null) {
                break;
            }

            const text = userInput.trim();
            if (!text) {
                continue;
            }
            if (text === "/exit" || text === "/quit") {
                break;
            }

            await recipePyreplUserPromptSet(repl, text);
            messages.push({
                role: "user",
                content: [{ type: "text", text: USER_PROMPT_READY_MESSAGE }],
                timestamp: Date.now()
            });

            await recipePyreplTurnRun(messages, authPath, model, repl, systemPrompt);
        }
    } finally {
        await repl.close();
    }

    console.log("Exited.");
}

async function recipePyreplTurnRun(
    messages: Context["messages"],
    authPath: string,
    model: Model<Api>,
    repl: RecipePythonRepl,
    systemPrompt: string
): Promise<void> {
    for (let step = 0; step < MAX_INTERNAL_STEPS; step += 1) {
        const apiKey = await recipeAnthropicApiKeyResolve(authPath);
        const reply = await recipeAnthropicReplyGet(messages, apiKey, model, {
            sessionId: "recipe-pyrepl",
            systemPrompt,
            tools: RECIPE_PYREPL_TOOLS,
            requireText: false
        });

        messages.push(reply.message);

        if (recipePyreplAssistantHasText(reply.message)) {
            recipePyreplProtocolRetryAdd(messages);
            continue;
        }

        const toolCalls = recipePyreplToolCallsExtract(reply.message);
        if (toolCalls.length === 0) {
            recipePyreplProtocolRetryAdd(messages);
            continue;
        }

        for (const toolCall of toolCalls) {
            if (toolCall.name === "python_exec") {
                await recipePyreplPythonRun(messages, repl, toolCall);
                continue;
            }

            if (toolCall.name === "output_string") {
                const didFinish = recipePyreplOutputHandle(messages, toolCall);
                if (didFinish) {
                    return;
                }
                continue;
            }

            recipePyreplToolResultAdd(
                messages,
                toolCall,
                `Unknown tool: ${toolCall.name}. Use python_exec or output_string.`,
                true
            );
        }
    }

    console.error(`\nError: Max internal steps (${MAX_INTERNAL_STEPS}) reached.\n`);
}

async function recipePyreplPythonRun(
    messages: Context["messages"],
    repl: RecipePythonRepl,
    toolCall: ToolCall
): Promise<void> {
    const code = recipePyreplToolStringArgumentGet(toolCall, "code");
    if (!code) {
        recipePyreplToolResultAdd(
            messages,
            toolCall,
            "Invalid arguments: python_exec requires string field `code`.",
            true
        );
        return;
    }

    console.log("\nAssistant python code:");
    console.log(code);

    const execution = await repl.execute(code);
    const consoleSummary = recipePyreplExecutionConsoleFormat(execution);
    console.log(`\nPython execution result:\n${consoleSummary}\n`);

    const modelFeedback = recipePyreplExecutionFeedbackBuild(execution);
    recipePyreplToolResultAdd(messages, toolCall, modelFeedback, !execution.ok);
}

function recipePyreplOutputHandle(messages: Context["messages"], toolCall: ToolCall): boolean {
    const output = recipePyreplToolStringArgumentGet(toolCall, "output");
    if (output === null) {
        recipePyreplToolResultAdd(
            messages,
            toolCall,
            "Invalid arguments: output_string requires string field `output`.",
            true
        );
        return false;
    }

    recipePyreplToolResultAdd(messages, toolCall, "Output delivered.", false);
    console.log(`\nAssistant: ${output}\n`);
    return true;
}

function recipePyreplToolResultAdd(
    messages: Context["messages"],
    toolCall: ToolCall,
    text: string,
    isError: boolean
): void {
    messages.push({
        role: "toolResult",
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        content: [{ type: "text", text }],
        isError,
        timestamp: Date.now()
    });
}

function recipePyreplExecutionConsoleFormat(result: RecipePythonExecutionResult): string {
    const parts: string[] = [];
    parts.push(`ok: ${result.ok ? "true" : "false"}`);
    if (result.stdout.trim()) {
        parts.push(`stdout:\n${result.stdout.trimEnd()}`);
    }
    if (result.stderr.trim()) {
        parts.push(`stderr:\n${result.stderr.trimEnd()}`);
    }
    if (result.result !== null) {
        parts.push(`result: ${result.result}`);
    }
    if (result.error) {
        parts.push(`error:\n${result.error.trimEnd()}`);
    }
    return parts.join("\n\n");
}

function recipePyreplExecutionFeedbackBuild(result: RecipePythonExecutionResult): string {
    const sections = [
        "Python execution feedback:",
        `ok=${result.ok ? "true" : "false"}`,
        `stdout:\n${result.stdout || "(empty)"}`,
        `stderr:\n${result.stderr || "(empty)"}`,
        `result:\n${result.result ?? "(none)"}`,
        `error:\n${result.error ?? "(none)"}`
    ];
    return sections.join("\n\n");
}

function recipePyreplAssistantHasText(message: Context["messages"][number]): boolean {
    if (message.role !== "assistant") {
        return false;
    }
    return message.content.some(
        (block) => block.type === "text" && typeof block.text === "string" && block.text.trim().length > 0
    );
}

function recipePyreplToolCallsExtract(message: Context["messages"][number]): ToolCall[] {
    if (message.role !== "assistant") {
        return [];
    }
    return message.content.filter((block): block is ToolCall => block.type === "toolCall");
}

function recipePyreplToolStringArgumentGet(toolCall: ToolCall, key: string): string | null {
    const value = toolCall.arguments[key];
    return typeof value === "string" ? value : null;
}

function recipePyreplProtocolRetryAdd(messages: Context["messages"]): void {
    messages.push({
        role: "user",
        content: [{ type: "text", text: PROTOCOL_RETRY_MESSAGE }],
        timestamp: Date.now()
    });
}

async function recipePyreplUserPromptSet(repl: RecipePythonRepl, userPrompt: string): Promise<void> {
    const execution = await repl.execute(`userPrompt = ${JSON.stringify(userPrompt)}`);
    if (execution.ok) {
        return;
    }

    const details = execution.error ?? (execution.stderr.trim() || "unknown error");
    throw new Error(`Failed to set userPrompt in python session: ${details}`);
}
