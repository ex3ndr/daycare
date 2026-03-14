import { contextForAgent } from "../engine/agents/context.js";
import { agentHistoryLoad } from "../engine/agents/ops/agentHistoryLoad.js";
import {
    agentPathAgent,
    agentPathApp,
    agentPathConnector,
    agentPathCron,
    agentPathSubuser,
    agentPathSupervisor,
    agentPathTask
} from "../engine/agents/ops/agentPathBuild.js";
import type { AgentPath } from "../engine/agents/ops/agentPathTypes.js";
import type { AgentCreationConfig, AgentHistoryRecord, AgentInboxResult } from "../engine/agents/ops/agentTypes.js";
import type { EngineEvent } from "../engine/ipc/events.js";
import type { EvalHarness } from "./evalHarness.js";
import type { EvalScenario, EvalTurn } from "./evalScenario.js";

export type EvalTurnResult = {
    turn: EvalTurn;
    result: AgentInboxResult;
    durationMs: number;
    history: AgentHistoryRecord[];
};

export type EvalTrace = {
    scenario: EvalScenario;
    agentId: string;
    agentPath: AgentPath;
    startedAt: number;
    endedAt: number;
    setup: {
        result: Extract<AgentInboxResult, { type: "reset" }>;
        durationMs: number;
    };
    turnResults: EvalTurnResult[];
    history: AgentHistoryRecord[];
    events: EngineEvent[];
};

/**
 * Runs an eval scenario synchronously against an in-process AgentSystem and collects the resulting trace.
 * Expects: harness is already booted and scenario has been validated with evalScenarioParse().
 */
export async function evalRun(scenario: EvalScenario, harness: EvalHarness): Promise<EvalTrace> {
    const ownerCtx = await harness.agentSystem.ownerCtxEnsure();
    const agentPath = evalAgentPathBuild(ownerCtx.userId, scenario);
    const creationConfig = evalCreationConfigBuild(ownerCtx.userId, scenario);
    const target = { path: agentPath };
    const events: EngineEvent[] = [];
    const startedAt = Date.now();
    const unsubscribe = harness.eventBus.onEvent((event) => {
        events.push(event);
    });

    try {
        const setupStartedAt = Date.now();
        const setupResult = await harness.agentSystem.postAndAwait(
            ownerCtx,
            target,
            { type: "reset", message: `Eval scenario: ${scenario.name}` },
            creationConfig
        );
        const setupDurationMs = Date.now() - setupStartedAt;
        const agentId = await harness.agentSystem.agentIdForTarget(ownerCtx, target, creationConfig);
        const agentCtx = contextForAgent({ userId: ownerCtx.userId, agentId });
        const turnResults: EvalTurnResult[] = [];

        for (const turn of scenario.turns) {
            const turnStartedAt = Date.now();
            const result = await harness.agentSystem.postAndAwait(ownerCtx, { agentId }, evalInboxMessageBuild(turn));
            const durationMs = Date.now() - turnStartedAt;
            const history = await agentHistoryLoad(harness.storage, agentCtx);
            turnResults.push({
                turn,
                result,
                durationMs,
                history
            });
        }

        const history = await agentHistoryLoad(harness.storage, agentCtx);
        const endedAt = Date.now();

        if (setupResult.type !== "reset") {
            throw new Error(`Unexpected setup result type: ${setupResult.type}`);
        }

        return {
            scenario,
            agentId,
            agentPath,
            startedAt,
            endedAt,
            setup: {
                result: setupResult,
                durationMs: setupDurationMs
            },
            turnResults,
            history,
            events
        };
    } finally {
        unsubscribe();
    }
}

function evalInboxMessageBuild(turn: EvalTurn) {
    return {
        type: "message" as const,
        message: {
            text: turn.text
        },
        context: {}
    };
}

function evalAgentPathBuild(userId: string, scenario: EvalScenario): AgentPath {
    const pathSegment = scenario.agent.path.trim();
    if (scenario.agent.kind === "connector") {
        return agentPathConnector(userId, pathSegment);
    }
    if (scenario.agent.kind === "agent") {
        return agentPathAgent(userId, pathSegment);
    }
    if (scenario.agent.kind === "app") {
        return agentPathApp(userId, pathSegment);
    }
    if (scenario.agent.kind === "cron") {
        return agentPathCron(userId, pathSegment);
    }
    if (scenario.agent.kind === "task") {
        return agentPathTask(userId, pathSegment);
    }
    if (scenario.agent.kind === "subuser") {
        return agentPathSubuser(userId, pathSegment);
    }
    if (scenario.agent.kind === "supervisor") {
        return agentPathSupervisor(userId);
    }
    throw new Error(`Unsupported eval agent kind: ${scenario.agent.kind}`);
}

function evalCreationConfigBuild(userId: string, scenario: EvalScenario): AgentCreationConfig {
    const pathSegment = scenario.agent.path.trim();
    if (scenario.agent.kind === "connector") {
        return {
            kind: "connector",
            foreground: true,
            connector: {
                name: pathSegment,
                key: userId
            }
        };
    }
    if (scenario.agent.kind === "supervisor") {
        return {
            kind: "supervisor",
            name: null
        };
    }
    return {
        kind: scenario.agent.kind,
        name: pathSegment
    };
}
