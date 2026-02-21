import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ToolExecutionContext } from "@/types";
import type { ToolResolverApi } from "../toolResolver.js";
import { executablePromptExpand } from "./executablePromptExpand.js";

const { rlmExecuteMock, montyRuntimePreambleBuildMock } = vi.hoisted(() => ({
    rlmExecuteMock: vi.fn(),
    montyRuntimePreambleBuildMock: vi.fn(() => "# preamble")
}));

vi.mock("../rlm/rlmExecute.js", () => ({
    rlmExecute: rlmExecuteMock
}));

vi.mock("../monty/montyRuntimePreambleBuild.js", () => ({
    montyRuntimePreambleBuild: montyRuntimePreambleBuildMock
}));

describe("executablePromptExpand", () => {
    beforeEach(() => {
        rlmExecuteMock.mockReset();
        montyRuntimePreambleBuildMock.mockClear();
    });

    it("returns prompt unchanged when no run_python tags exist", async () => {
        const resolver = resolverBuild();
        const context = contextBuild();
        const prompt = "no executable blocks";

        const result = await executablePromptExpand(prompt, context, resolver);

        expect(result).toEqual({ expanded: prompt, skipTurn: false });
        expect(rlmExecuteMock).not.toHaveBeenCalled();
        expect(montyRuntimePreambleBuildMock).not.toHaveBeenCalled();
    });

    it("expands a single run_python block", async () => {
        rlmExecuteMock.mockResolvedValue({
            output: "42",
            printOutput: [],
            toolCallCount: 0
        });
        const resolver = resolverBuild();
        const context = contextBuild();

        const result = await executablePromptExpand("A<run_python>1+1</run_python>B", context, resolver);

        expect(result).toEqual({ expanded: "A42B", skipTurn: false });
        expect(rlmExecuteMock).toHaveBeenCalledTimes(1);
        expect(rlmExecuteMock).toHaveBeenCalledWith(
            "1+1",
            "# preamble",
            context,
            resolver,
            expect.any(String),
            undefined
        );
    });

    it("expands multiple run_python blocks in prompt order", async () => {
        rlmExecuteMock
            .mockResolvedValueOnce({
                output: "FIRST",
                printOutput: [],
                toolCallCount: 0
            })
            .mockResolvedValueOnce({
                output: "SECOND",
                printOutput: [],
                toolCallCount: 0
            });
        const resolver = resolverBuild();
        const context = contextBuild();

        const result = await executablePromptExpand(
            "x <run_python>first()</run_python> y <run_python>second()</run_python> z",
            context,
            resolver
        );

        expect(result).toEqual({ expanded: "x FIRST y SECOND z", skipTurn: false });
        expect(rlmExecuteMock).toHaveBeenNthCalledWith(
            1,
            "first()",
            "# preamble",
            context,
            resolver,
            expect.any(String),
            undefined
        );
        expect(rlmExecuteMock).toHaveBeenNthCalledWith(
            2,
            "second()",
            "# preamble",
            context,
            resolver,
            expect.any(String),
            undefined
        );
    });

    it("replaces failed executions with exec_error blocks", async () => {
        rlmExecuteMock.mockRejectedValue(new Error("boom"));
        const resolver = resolverBuild();
        const context = contextBuild();

        const result = await executablePromptExpand("a <run_python>broken()</run_python> b", context, resolver);

        expect(result).toEqual({ expanded: "a <exec_error>boom</exec_error> b", skipTurn: false });
    });

    it("returns skipTurn true and stops processing when skip() is called", async () => {
        rlmExecuteMock.mockResolvedValue({
            output: "Turn skipped",
            printOutput: [],
            toolCallCount: 0,
            skipTurn: true
        });
        const resolver = resolverBuild();
        const context = contextBuild();

        const result = await executablePromptExpand("before <run_python>skip()</run_python> after", context, resolver);

        expect(result.skipTurn).toBe(true);
        expect(rlmExecuteMock).toHaveBeenCalledTimes(1);
    });

    it("stops processing remaining blocks after skip()", async () => {
        rlmExecuteMock
            .mockResolvedValueOnce({
                output: "FIRST",
                printOutput: [],
                toolCallCount: 0
            })
            .mockResolvedValueOnce({
                output: "Turn skipped",
                printOutput: [],
                toolCallCount: 0,
                skipTurn: true
            });
        const resolver = resolverBuild();
        const context = contextBuild();

        const result = await executablePromptExpand(
            "<run_python>a()</run_python> <run_python>skip()</run_python> <run_python>c()</run_python>",
            context,
            resolver
        );

        expect(result.skipTurn).toBe(true);
        // Third block should not execute
        expect(rlmExecuteMock).toHaveBeenCalledTimes(2);
    });
});

function resolverBuild(): ToolResolverApi {
    return {
        listTools: vi.fn(() => []),
        execute: vi.fn()
    } as unknown as ToolResolverApi;
}

function contextBuild(): ToolExecutionContext {
    return {
        connectorRegistry: null as unknown as ToolExecutionContext["connectorRegistry"],
        fileStore: null as unknown as ToolExecutionContext["fileStore"],
        auth: null as unknown as ToolExecutionContext["auth"],
        logger: console as unknown as ToolExecutionContext["logger"],
        assistant: null,
        permissions: {
            workingDir: "/",
            writeDirs: [],
            readDirs: [],
            network: false,
            events: false
        },
        agent: null as unknown as ToolExecutionContext["agent"],
        ctx: null as unknown as ToolExecutionContext["ctx"],
        source: "test",
        messageContext: {},
        agentSystem: null as unknown as ToolExecutionContext["agentSystem"],
        heartbeats: null as unknown as ToolExecutionContext["heartbeats"]
    };
}
