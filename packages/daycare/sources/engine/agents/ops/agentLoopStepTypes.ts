import type { MontySnapshot } from "@pydantic/monty";

import type { ToolExecutionContext } from "@/types";
import type { RlmCheckSteeringCallback, RlmExecuteResult } from "../../modules/rlm/rlmExecute.js";
import type { RlmPrintCaptureState } from "../../modules/rlm/rlmPrintCapture.js";
import type { ToolResolverApi } from "../../modules/toolResolver.js";

type AgentLoopBlockState = {
    iteration: number;
    blocks: string[];
    blockIndex: number;
    preamble: string;
    toolCallId: string;
    assistantRecordAt: number;
    historyResponseText: string;
    executionContext: ToolExecutionContext;
    trackingToolResolver: ToolResolverApi;
    checkSteering: RlmCheckSteeringCallback;
};

export type InferencePhase = {
    type: "inference";
    iteration: number;
};

export type VmStartPhase = {
    type: "vm_start";
    blockState: AgentLoopBlockState;
};

export type ToolCallPhase = {
    type: "tool_call";
    blockState: AgentLoopBlockState;
    snapshot: MontySnapshot;
    printOutput: string[];
    printCapture: RlmPrintCaptureState;
    printCallback: (...values: unknown[]) => void;
    toolCallCount: number;
};

export type BlockCompletePhase = {
    type: "block_complete";
    blockState: AgentLoopBlockState;
    result: RlmExecuteResult;
};

export type DonePhase = {
    type: "done";
    reason: "complete" | "skip_turn" | "tool_loop_limit";
};

export type AgentLoopPhase = InferencePhase | VmStartPhase | ToolCallPhase | BlockCompletePhase | DonePhase;
