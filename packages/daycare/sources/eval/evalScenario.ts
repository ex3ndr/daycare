import { z } from "zod";

import type { AgentKind } from "@/types";

const EVAL_AGENT_KINDS = ["connector", "agent", "app", "cron", "task", "subuser", "supervisor"] as const;

const evalTurnSchema = z
    .object({
        role: z.literal("user"),
        text: z.string().trim().min(1, "turn text is required")
    })
    .strict();

const evalInferenceToolCallSchema = z
    .object({
        id: z.string().trim().min(1, "inference toolCall.id is required"),
        name: z.string().trim().min(1, "inference toolCall.name is required"),
        arguments: z.record(z.string(), z.unknown())
    })
    .strict();

const evalInferenceBranchSchema = z
    .object({
        whenSystemPromptIncludes: z
            .array(z.string().trim().min(1, "whenSystemPromptIncludes entry is required"))
            .optional(),
        message: z.string().trim().min(1, "inference message is required").optional(),
        toolCall: evalInferenceToolCallSchema.optional()
    })
    .strict()
    .superRefine((branch, ctx) => {
        const responseCount = (branch.message ? 1 : 0) + (branch.toolCall ? 1 : 0);
        if (responseCount !== 1) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "each inference branch must define exactly one of message or toolCall"
            });
        }
    });

const evalInferenceCallSchema = z
    .object({
        branches: z.array(evalInferenceBranchSchema).min(1, "inference call must contain at least one branch")
    })
    .strict();

const evalInferenceSchema = z
    .object({
        type: z.literal("scripted"),
        calls: z.array(evalInferenceCallSchema).min(1, "inference calls must contain at least one step")
    })
    .strict();

const evalScenarioSchema = z
    .object({
        name: z
            .string()
            .trim()
            .min(1, "name is required")
            .refine((value) => !value.includes("/"), "name must not include '/'"),
        agent: z
            .object({
                kind: z.enum(EVAL_AGENT_KINDS),
                path: z
                    .string()
                    .trim()
                    .min(1, "agent.path is required")
                    .refine((value) => !value.includes("/"), "agent.path must not include '/'")
            })
            .strict(),
        turns: z.array(evalTurnSchema).min(1, "turns must contain at least one turn"),
        inference: evalInferenceSchema.optional()
    })
    .strict();

export type EvalAgentKind = (typeof EVAL_AGENT_KINDS)[number] & AgentKind;

export type EvalTurn = {
    role: "user";
    text: string;
};

export type EvalInferenceBranch = {
    whenSystemPromptIncludes?: string[];
    message?: string;
    toolCall?: {
        id: string;
        name: string;
        arguments: Record<string, unknown>;
    };
};

export type EvalScenarioInference = {
    type: "scripted";
    calls: Array<{
        branches: EvalInferenceBranch[];
    }>;
};

export type EvalScenario = {
    name: string;
    agent: {
        kind: EvalAgentKind;
        path: string;
    };
    turns: EvalTurn[];
    inference?: EvalScenarioInference;
};

/**
 * Parses and validates an eval scenario JSON payload.
 * Expects: json comes from a decoded scenario file and uses only supported direct agent kinds.
 */
export function evalScenarioParse(json: unknown): EvalScenario {
    const parsed = evalScenarioSchema.safeParse(json);
    if (!parsed.success) {
        throw new Error(evalScenarioErrorBuild(parsed.error));
    }
    return parsed.data as EvalScenario;
}

function evalScenarioErrorBuild(error: z.ZodError): string {
    const firstIssue = error.issues[0];
    if (!firstIssue) {
        return "Invalid eval scenario.";
    }
    const path = firstIssue.path.length > 0 ? firstIssue.path.join(".") : "scenario";
    return `Invalid eval scenario at ${path}: ${firstIssue.message}`;
}
