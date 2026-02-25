import { describe, expect, expectTypeOf, it } from "vitest";

import type {
    AgentLoopPhase,
    BlockCompletePhase,
    DonePhase,
    InferencePhase,
    ToolCallPhase,
    VmStartPhase
} from "./agentLoopStepTypes.js";

describe("agentLoopStepTypes", () => {
    it("supports discriminated union narrowing by phase type", () => {
        const phaseType = phaseLabel({ type: "done", reason: "complete" } as AgentLoopPhase);
        expect(phaseType).toBe("done");
    });

    it("provides typed phase extracts for compile-time narrowing", () => {
        expectTypeOf<Extract<AgentLoopPhase, { type: "inference" }>>().toEqualTypeOf<InferencePhase>();
        expectTypeOf<Extract<AgentLoopPhase, { type: "vm_start" }>>().toEqualTypeOf<VmStartPhase>();
        expectTypeOf<Extract<AgentLoopPhase, { type: "tool_call" }>>().toEqualTypeOf<ToolCallPhase>();
        expectTypeOf<Extract<AgentLoopPhase, { type: "block_complete" }>>().toEqualTypeOf<BlockCompletePhase>();
        expectTypeOf<Extract<AgentLoopPhase, { type: "done" }>>().toEqualTypeOf<DonePhase>();
    });
});

function phaseLabel(phase: AgentLoopPhase): AgentLoopPhase["type"] {
    switch (phase.type) {
        case "inference":
            return phase.type;
        case "vm_start":
            return phase.type;
        case "tool_call":
            return phase.type;
        case "block_complete":
            return phase.type;
        case "done":
            return phase.type;
        default: {
            const exhaustive: never = phase;
            return exhaustive;
        }
    }
}
