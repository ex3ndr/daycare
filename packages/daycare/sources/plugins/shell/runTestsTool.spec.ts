import { afterEach, describe, expect, it, vi } from "vitest";
import type { ToolExecutionContext } from "@/types";
import { buildRunTestsTool } from "./runTestsTool.js";

const toolCall = { id: "tool-call-run-tests", name: "run_tests" };

describe("buildRunTestsTool", () => {
    const originalCi = process.env.CI;

    afterEach(() => {
        if (originalCi === undefined) {
            delete process.env.CI;
            return;
        }
        process.env.CI = originalCi;
    });

    it("exposes expected schema", () => {
        const tool = buildRunTestsTool();
        expect(tool.tool.parameters.type).toBe("object");
        expect(tool.tool.parameters.required ?? []).toEqual([]);
    });

    it("runs `yarn test` by default", async () => {
        delete process.env.CI;
        const tool = buildRunTestsTool();
        const { context, exec } = createContext({
            stdout: "ok",
            stderr: "",
            failed: false,
            exitCode: 0,
            signal: null,
            cwd: "/workspace"
        });

        const result = await tool.execute({}, context, toolCall);
        expect(result.toolMessage.isError).toBe(false);
        expect(result.typedResult.summary).toContain("stdout:\nok");
        expect(exec).toHaveBeenCalledOnce();
        expect(exec.mock.calls[0]?.[0]?.command).toBe("yarn test");
    });

    it("hides tool by default and rejects execution in CI", async () => {
        process.env.CI = "true";
        const tool = buildRunTestsTool();
        const { context, exec } = createContext({
            stdout: "",
            stderr: "",
            failed: false,
            exitCode: 0,
            signal: null,
            cwd: "/workspace"
        });

        expect(tool.visibleByDefault?.({} as never)).toBe(false);
        await expect(tool.execute({}, context, toolCall)).rejects.toThrow("disabled when CI is enabled");
        expect(exec).not.toHaveBeenCalled();
    });
});

function createContext(execResult: {
    stdout: string;
    stderr: string;
    failed: boolean;
    exitCode: number | null;
    signal: string | null;
    cwd: string;
}) {
    const exec = vi.fn(async (_args: { command: string; allowedDomains?: string[] }) => execResult);
    const context = {
        sandbox: {
            workingDir: "/workspace",
            exec
        }
    } as unknown as ToolExecutionContext;
    return { context, exec };
}
