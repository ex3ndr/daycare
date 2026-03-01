import { describe, expect, it } from "vitest";

import type { ToolExecutionContext, ToolExecutionResult } from "@/types";
import { buildMontyPythonTool } from "../../../plugins/monty-python/tool.js";
import { montyPythonTypeFromSchema } from "./montyPythonTypeFromSchema.js";

type RuntimeTypeCase = {
    name: string;
    schema: unknown;
    expectedTypeHint: string;
    validReturn: string;
    invalidReturn: string;
};

const runtimeCases: RuntimeTypeCase[] = [
    {
        name: "string",
        schema: { type: "string" },
        expectedTypeHint: "str",
        validReturn: "'hello'",
        invalidReturn: "1"
    },
    {
        name: "integer",
        schema: { type: "integer" },
        expectedTypeHint: "int",
        validReturn: "42",
        invalidReturn: "'oops'"
    },
    {
        name: "number",
        schema: { type: "number" },
        expectedTypeHint: "float",
        validReturn: "3.14",
        invalidReturn: "'oops'"
    },
    {
        name: "boolean",
        schema: { type: "boolean" },
        expectedTypeHint: "bool",
        validReturn: "True",
        invalidReturn: "'oops'"
    },
    {
        name: "null",
        schema: { type: "null" },
        expectedTypeHint: "None",
        validReturn: "None",
        invalidReturn: "1"
    },
    {
        name: "array of integers",
        schema: { type: "array", items: { type: "integer" } },
        expectedTypeHint: "list[int]",
        validReturn: "[1, 2, 3]",
        invalidReturn: "['oops']"
    },
    {
        name: "object",
        schema: { type: "object", properties: { id: { type: "integer" } } },
        expectedTypeHint: "dict[str, Any]",
        validReturn: "{'id': 1}",
        invalidReturn: "1"
    },
    {
        name: "array of objects",
        schema: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    id: { type: "integer" }
                }
            }
        },
        expectedTypeHint: "list[dict[str, Any]]",
        validReturn: "[{'id': 1}]",
        invalidReturn: "[1]"
    }
];

describe("montyPythonTypeFromSchema runtime", () => {
    it.each(runtimeCases)("type-checks generated return annotation for $name", async (testCase) => {
        const typeHint = montyPythonTypeFromSchema(testCase.schema);
        expect(typeHint).toBe(testCase.expectedTypeHint);

        const valid = await pythonTypeCheckRun(typeHint, testCase.validReturn);
        expect(valid.toolMessage.isError).toBe(false);

        const invalid = await pythonTypeCheckRun(typeHint, testCase.invalidReturn);
        expect(invalid.toolMessage.isError).toBe(true);
        expect(toolMessageText(invalid)).toContain("Python type check failed");
    });
});

async function pythonTypeCheckRun(returnType: string, returnExpression: string): Promise<ToolExecutionResult> {
    const tool = buildMontyPythonTool("python");
    const code = [
        "from typing import Any",
        `def produce() -> ${returnType}:`,
        `    return ${returnExpression}`,
        "produce()"
    ].join("\n");

    return tool.execute({ code, typeCheck: true }, toolExecutionContextBuild(), { id: "type-check", name: "python" });
}

function toolExecutionContextBuild(): ToolExecutionContext {
    return {
        connectorRegistry: null as unknown as ToolExecutionContext["connectorRegistry"],
        sandbox: null as unknown as ToolExecutionContext["sandbox"],
        auth: null as unknown as ToolExecutionContext["auth"],
        logger: console as unknown as ToolExecutionContext["logger"],
        assistant: null,
        agent: null as unknown as ToolExecutionContext["agent"],
        ctx: null as unknown as ToolExecutionContext["ctx"],
        source: "test",
        messageContext: {},
        agentSystem: null as unknown as ToolExecutionContext["agentSystem"]
    };
}

function toolMessageText(result: ToolExecutionResult): string {
    return result.toolMessage.content
        .filter((entry) => entry.type === "text")
        .map((entry) => ("text" in entry ? (entry.text ?? "") : ""))
        .join("\n");
}
