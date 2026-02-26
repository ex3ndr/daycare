import { describe, expect, it, vi } from "vitest";
import type { ToolExecutionContext } from "@/types";
import { buildLsTool } from "./lsTool.js";

const toolCall = { id: "tool-call-ls", name: "ls" };

describe("buildLsTool", () => {
    it("exposes expected schema", () => {
        const tool = buildLsTool();
        expect(tool.tool.parameters.type).toBe("object");
        expect(tool.tool.parameters.required ?? []).toEqual([]);
    });

    it("executes ls and returns sorted output", async () => {
        const tool = buildLsTool();
        const { context, exec } = createContext({
            stdout: "b/\na/\n",
            stderr: "",
            failed: false,
            exitCode: 0,
            signal: null,
            cwd: "/workspace"
        });

        const result = await tool.execute({ path: "src", limit: 10 }, context, toolCall);
        expect(result.toolMessage.isError).toBe(false);
        expect(result.typedResult.summary).toBe("a/\nb/");
        expect(exec).toHaveBeenCalledOnce();
        expect(exec.mock.calls[0]?.[0]?.command).toContain("'ls'");
        expect(exec.mock.calls[0]?.[0]?.command).toContain("'-1apL'");
    });

    it("returns an error result when ls fails", async () => {
        const tool = buildLsTool();
        const { context } = createContext({
            stdout: "",
            stderr: "ls: cannot access '/missing': No such file or directory",
            failed: true,
            exitCode: 2,
            signal: null,
            cwd: "/workspace"
        });

        const result = await tool.execute({ path: "/missing" }, context, toolCall);
        expect(result.toolMessage.isError).toBe(true);
        expect(result.typedResult.summary).toContain("ls failed");
    });

    it("expands ~ paths before shell quoting", async () => {
        const tool = buildLsTool();
        const { context, exec } = createContext(
            {
                stdout: "",
                stderr: "",
                failed: false,
                exitCode: 0,
                signal: null,
                cwd: "/workspace"
            },
            { homeDir: "/sandbox-home" }
        );

        await tool.execute({ path: "~/projects" }, context, toolCall);
        expect(exec).toHaveBeenCalledOnce();
        expect(exec.mock.calls[0]?.[0]?.command).toContain("'/sandbox-home/projects'");
        expect(exec.mock.calls[0]?.[0]?.command).not.toContain("'~/projects'");
    });

    it("uses container home when docker sandbox is enabled", async () => {
        const tool = buildLsTool();
        const { context, exec } = createContext(
            {
                stdout: "",
                stderr: "",
                failed: false,
                exitCode: 0,
                signal: null,
                cwd: "/home/workspace"
            },
            { homeDir: "/host/home", dockerEnabled: true }
        );

        await tool.execute({ path: "~/projects" }, context, toolCall);
        expect(exec).toHaveBeenCalledOnce();
        expect(exec.mock.calls[0]?.[0]?.command).toContain("'/home/projects'");
        expect(exec.mock.calls[0]?.[0]?.command).not.toContain("'/host/home/projects'");
    });
});

function createContext(
    execResult: {
        stdout: string;
        stderr: string;
        failed: boolean;
        exitCode: number | null;
        signal: string | null;
        cwd: string;
    },
    options: { homeDir?: string; dockerEnabled?: boolean } = {}
) {
    const exec = vi.fn(async (_args: { command: string; allowedDomains?: string[] }) => execResult);
    const context = {
        sandbox: {
            execWorkingDir: "/workspace",
            homeDir: options.homeDir ?? "/home/test",
            docker: options.dockerEnabled ? { enabled: true } : undefined,
            exec
        }
    } as unknown as ToolExecutionContext;
    return { context, exec };
}
