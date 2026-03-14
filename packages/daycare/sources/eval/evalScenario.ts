import { z } from "zod";

import type { AgentKind } from "@/types";

const EVAL_AGENT_KINDS = ["connector", "agent", "app", "cron", "task", "subuser", "supervisor"] as const;

const evalTurnSchema = z
    .object({
        role: z.literal("user"),
        text: z.string().trim().min(1, "turn text is required")
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
        turns: z.array(evalTurnSchema).min(1, "turns must contain at least one turn")
    })
    .strict();

export type EvalAgentKind = (typeof EVAL_AGENT_KINDS)[number] & AgentKind;

export type EvalTurn = {
    role: "user";
    text: string;
};

export type EvalScenario = {
    name: string;
    agent: {
        kind: EvalAgentKind;
        path: string;
    };
    turns: EvalTurn[];
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
