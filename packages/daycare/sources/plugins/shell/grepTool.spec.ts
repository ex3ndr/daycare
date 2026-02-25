import { describe, expect, it, vi } from "vitest";
import type { ToolExecutionContext } from "@/types";
import { buildGrepTool } from "./grepTool.js";

const toolCall = { id: "tool-call-grep", name: "grep" };

describe("buildGrepTool", () => {
    it("exposes expected schema", () => {
        const tool = buildGrepTool();
        expect(tool.tool.parameters.type).toBe("object");
        expect(tool.tool.parameters.required).toEqual(["pattern"]);
    });

    it("executes rg and formats JSON output", async () => {
        const tool = buildGrepTool();
        const stdout = JSON.stringify({
            type: "match",
            data: {
                path: { text: "/workspace/src/app.ts" },
                lines: { text: "const app = true;\\n" },
                line_number: 9
            }
        });
        const { context, exec } = createContext({
            stdout,
            stderr: "",
            failed: false,
            exitCode: 0,
            signal: null,
            cwd: "/workspace"
        });

        const result = await tool.execute(
            {
                pattern: "app",
                glob: "*.ts",
                ignoreCase: true,
                context: 1,
                limit: 10
            },
            context,
            toolCall
        );

        expect(result.toolMessage.isError).toBe(false);
        expect(result.typedResult.count).toBe(1);
        expect(result.typedResult.summary).toContain("src/app.ts:9:const app = true;");
        expect(exec).toHaveBeenCalledOnce();
        expect(exec.mock.calls[0]?.[0]?.command).toContain("'rg'");
        expect(exec.mock.calls[0]?.[0]?.command).toContain("'--json'");
        expect(exec.mock.calls[0]?.[0]?.command).toContain("'-g' '*.ts'");
    });

    it("treats rg exit code 1 as no matches", async () => {
        const tool = buildGrepTool();
        const { context } = createContext({
            stdout: "",
            stderr: "",
            failed: true,
            exitCode: 1,
            signal: null,
            cwd: "/workspace"
        });

        const result = await tool.execute({ pattern: "missing" }, context, toolCall);
        expect(result.toolMessage.isError).toBe(false);
        expect(result.typedResult.count).toBe(0);
        expect(result.typedResult.summary).toBe("No matches found.");
    });

    it("returns an error result when rg fails unexpectedly", async () => {
        const tool = buildGrepTool();
        const { context } = createContext({
            stdout: "",
            stderr: "rg: command not found",
            failed: true,
            exitCode: 127,
            signal: null,
            cwd: "/workspace"
        });

        const result = await tool.execute({ pattern: "x" }, context, toolCall);
        expect(result.toolMessage.isError).toBe(true);
        expect(result.typedResult.summary).toContain("grep failed");
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
            exec,
            resolveVirtualPath: (p: string) => p
        }
    } as unknown as ToolExecutionContext;
    return { context, exec };
}
