import { describe, expect, it, vi } from "vitest";
import type { ToolExecutionContext } from "@/types";
import { buildFindTool } from "./findTool.js";

const toolCall = { id: "tool-call-find", name: "find" };

describe("buildFindTool", () => {
    it("exposes expected schema", () => {
        const tool = buildFindTool();
        expect(tool.tool.parameters.type).toBe("object");
        expect(tool.tool.parameters.required).toEqual(["pattern"]);
    });

    it("executes fd and returns formatted entries", async () => {
        const tool = buildFindTool();
        const { context, exec } = createContext({
            stdout: "/workspace/src/app.ts\n/workspace/src/tool.ts\n",
            stderr: "",
            failed: false,
            exitCode: 0,
            signal: null,
            cwd: "/workspace"
        });

        const result = await tool.execute(
            {
                pattern: "*.ts",
                path: "src",
                limit: 50
            },
            context,
            toolCall
        );

        expect(result.toolMessage.isError).toBe(false);
        expect(result.typedResult.count).toBe(2);
        expect(result.typedResult.summary).toContain("src/app.ts");
        expect(exec).toHaveBeenCalledOnce();
        expect(exec.mock.calls[0]?.[0]?.command).toContain("'fd'");
        expect(exec.mock.calls[0]?.[0]?.command).toContain("'--glob'");
        expect(exec.mock.calls[0]?.[0]?.command).toContain("'--exclude' '.git'");
    });

    it("returns an error result when fd execution fails", async () => {
        const tool = buildFindTool();
        const { context } = createContext({
            stdout: "",
            stderr: "fd: command not found",
            failed: true,
            exitCode: 127,
            signal: null,
            cwd: "/workspace"
        });

        const result = await tool.execute({ pattern: "*.ts" }, context, toolCall);
        expect(result.toolMessage.isError).toBe(true);
        expect(result.typedResult.summary).toContain("find failed");
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
