import { Monty } from "@pydantic/monty";
import type { ToolExecutionContext } from "@/types";
import { montyPreambleBuild } from "../monty/montyPreambleBuild.js";
import { RLM_TOOL_NAME, SKIP_TOOL_NAME } from "./rlmConstants.js";
import { rlmToolsForContextResolve } from "./rlmToolsForContextResolve.js";

const runtimePrelude = "ToolError = RuntimeError";

/**
 * Type-checks python code for the current execution context without running it.
 * Expects: context corresponds to the target agent/task execution context.
 * Optional parameterPreamble prepends type-annotated variable stubs for parameter validation.
 */
export function rlmVerify(
    code: string,
    context: ToolExecutionContext,
    parameterPreamble?: string
): { preamble: string; externalFunctions: string[] } {
    const toolResolver = context.toolResolver ?? context.agentSystem.toolResolver;
    if (!toolResolver) {
        throw new Error("rlmVerify failed: tool resolver is unavailable.");
    }

    const visibleTools = rlmToolsForContextResolve(toolResolver, context).filter((tool) => tool.name !== RLM_TOOL_NAME);
    const preamble = montyPreambleBuild(visibleTools);
    const externalFunctions = visibleTools.map((tool) => tool.name);
    if (!externalFunctions.includes(SKIP_TOOL_NAME)) {
        externalFunctions.push(SKIP_TOOL_NAME);
    }

    const fullPreamble = parameterPreamble ? `${preamble}\n${parameterPreamble}` : preamble;

    const script = `${runtimePrelude}\n\n${code}`;
    const monty = new Monty(script, {
        scriptName: "run_python.py",
        externalFunctions,
        typeCheck: false
    });
    monty.typeCheck(fullPreamble.length > 0 ? fullPreamble : undefined);

    return {
        preamble,
        externalFunctions
    };
}
