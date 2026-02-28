import { Type } from "@sinclair/typebox";
import { describe, expect, it, vi } from "vitest";
import type { ToolExecutionContext } from "@/types";
import { rlmVerify } from "./rlmVerify.js";

const tools = [
    {
        name: "echo",
        description: "Echo text.",
        parameters: Type.Object({ text: Type.String() }, { additionalProperties: false })
    }
];

describe("rlmVerify", () => {
    it("resolves preamble from context tools and type-checks without running code", () => {
        const result = rlmVerify("1 / 0\n'done'", createContext());

        expect(result.preamble).toContain("def echo");
        expect(result.externalFunctions).toContain("echo");
        expect(result.externalFunctions).toContain("skip");
    });

    it("fails when code calls an undefined function", () => {
        expect(() => rlmVerify("not_existing()", createContext())).toThrow("unresolved-reference");
    });

    it("fails on unsupported module usage via monty typing", () => {
        const code = "import json\njson.loads('{}')";
        expect(() => rlmVerify(code, createContext())).toThrow("unresolved-import");
    });

    it("fails when importing math functions", () => {
        const code = "from math import sqrt\nsqrt(4)";
        expect(() => rlmVerify(code, createContext())).toThrow("unresolved-import");
    });
});

function createContext(): ToolExecutionContext {
    const toolResolver = {
        listTools: () => tools,
        listToolsForAgent: () => tools,
        execute: vi.fn(async () => {
            throw new Error("not used");
        })
    };

    return {
        connectorRegistry: null as unknown as ToolExecutionContext["connectorRegistry"],
        sandbox: null as unknown as ToolExecutionContext["sandbox"],
        auth: null as unknown as ToolExecutionContext["auth"],
        logger: console as unknown as ToolExecutionContext["logger"],
        assistant: null,
        agent: null as unknown as ToolExecutionContext["agent"],
        ctx: { userId: "user-1", agentId: "agent-1" } as ToolExecutionContext["ctx"],
        source: "test",
        messageContext: {},
        agentSystem: {
            toolResolver
        } as unknown as ToolExecutionContext["agentSystem"],
        heartbeats: null as unknown as ToolExecutionContext["heartbeats"],
        toolResolver: toolResolver as ToolExecutionContext["toolResolver"]
    };
}
