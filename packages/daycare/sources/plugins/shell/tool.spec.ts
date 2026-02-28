import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createId } from "@paralleldrive/cuid2";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// bwrap is unavailable in GitHub Actions (RTM_NEWADDR: Operation not permitted)
const itIfSandbox = process.env.CI ? it.skip : it;

import type { AgentState, SessionPermissions, ToolExecutionContext } from "@/types";
import { Agent } from "../../engine/agents/agent.js";
import { contextForAgent } from "../../engine/agents/context.js";
import { AgentInbox } from "../../engine/agents/ops/agentInbox.js";
import { UserHome } from "../../engine/users/userHome.js";
import { Sandbox } from "../../sandbox/sandbox.js";
import { buildExecTool, buildWorkspaceReadJsonTool, buildWorkspaceReadTool, formatExecOutput } from "./tool.js";

const execToolCall = { id: "tool-call-1", name: "exec" };
const readToolCall = { id: "tool-call-2", name: "read" };
const readJsonToolCall = { id: "tool-call-3", name: "read_json" };
const READ_LIMIT_TEST_BYTES = 51 * 1024;

describe("read tool allowed paths", () => {
    let workingDir: string;
    let outsideDir: string;
    let outsideFile: string;
    let insideFile: string;

    beforeEach(async () => {
        workingDir = await fs.mkdtemp(path.join(os.tmpdir(), "read-tool-workspace-"));
        outsideDir = await fs.mkdtemp(path.join(os.tmpdir(), "read-tool-outside-"));
        outsideFile = path.join(outsideDir, "outside.txt");
        insideFile = path.join(workingDir, "inside.txt");
        await fs.writeFile(outsideFile, "outside-content", "utf8");
        await fs.writeFile(insideFile, "line-1\nline-2\nline-3", "utf8");
    });

    afterEach(async () => {
        await fs.rm(workingDir, { recursive: true, force: true });
        await fs.rm(outsideDir, { recursive: true, force: true });
    });

    it("allows reading any absolute path", async () => {
        const tool = buildWorkspaceReadTool();
        const context = createContext(workingDir);

        const result = await tool.execute({ path: outsideFile }, context, readToolCall);
        const text = toolMessageText(result.toolMessage.content);

        expect(result.toolMessage.isError).toBe(false);
        expect(text).toContain("outside-content");
    });

    it("supports relative read paths from workspace", async () => {
        const tool = buildWorkspaceReadTool();
        const context = createContext(workingDir);

        const result = await tool.execute({ path: "inside.txt" }, context, readToolCall);
        const text = toolMessageText(result.toolMessage.content);

        expect(result.toolMessage.isError).toBe(false);
        expect(text).toContain("line-1");
        expect(text).toContain("line-3");
    });

    it("supports line pagination with limit and offset", async () => {
        const tool = buildWorkspaceReadTool();
        const context = createContext(workingDir);

        const firstResult = await tool.execute({ path: insideFile, limit: 2 }, context, readToolCall);
        const firstText = toolMessageText(firstResult.toolMessage.content);
        expect(firstText).toContain("line-1\nline-2");
        expect(firstText).toContain("Use offset=3 to continue.");

        const secondResult = await tool.execute({ path: insideFile, offset: 3, limit: 1 }, context, readToolCall);
        const secondText = toolMessageText(secondResult.toolMessage.content);
        expect(secondText).toContain("line-3");
        expect(secondText).not.toContain("line-1");
    });

    it("returns home-relative path metadata outside workspace", async () => {
        const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "read-tool-home-"));
        const workspaceDir = path.join(homeDir, "desktop");
        const knowledgePath = path.join(homeDir, "knowledge", "USER.md");
        await fs.mkdir(workspaceDir, { recursive: true });
        await fs.mkdir(path.dirname(knowledgePath), { recursive: true });
        await fs.writeFile(knowledgePath, "name: steve", "utf8");
        const tool = buildWorkspaceReadTool();
        const context = createContext(workspaceDir, [homeDir], false, undefined, homeDir);

        try {
            const result = await tool.execute({ path: "../knowledge/USER.md" }, context, readToolCall);
            expect(result.toolMessage.isError).toBe(false);
            expect(result.typedResult.path).toBe("~/knowledge/USER.md");
            expect(result.typedResult.path).not.toContain(homeDir);
        } finally {
            await fs.rm(homeDir, { recursive: true, force: true });
        }
    });

    it("reads home-relative fallback path without ../ prefix", async () => {
        const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "read-tool-home-fallback-"));
        const workspaceDir = path.join(homeDir, "desktop");
        const knowledgePath = path.join(homeDir, "knowledge", "USER.md");
        await fs.mkdir(workspaceDir, { recursive: true });
        await fs.mkdir(path.dirname(knowledgePath), { recursive: true });
        await fs.writeFile(knowledgePath, "name: steve", "utf8");
        const tool = buildWorkspaceReadTool();
        const context = createContext(workspaceDir, [homeDir], false, undefined, homeDir);

        try {
            const result = await tool.execute({ path: "knowledge/USER.md" }, context, readToolCall);
            expect(result.toolMessage.isError).toBe(false);
            expect(result.typedResult.path).toBe("~/knowledge/USER.md");
            expect(toolMessageText(result.toolMessage.content)).toContain("name: steve");
        } finally {
            await fs.rm(homeDir, { recursive: true, force: true });
        }
    });

    it("returns actionable message when first line exceeds byte limit", async () => {
        const tool = buildWorkspaceReadTool();
        const context = createContext(workingDir);
        const largeLinePath = path.join(workingDir, "large-line.txt");
        await fs.writeFile(largeLinePath, `${"x".repeat(READ_LIMIT_TEST_BYTES)}\nline-2`, "utf8");

        const result = await tool.execute({ path: largeLinePath }, context, readToolCall);
        const text = toolMessageText(result.toolMessage.content);

        expect(result.toolMessage.isError).toBe(false);
        expect(text).toContain("exceeds 50.0KB limit");
        expect(text).toContain("Use bash: sed -n '1p'");
    });

    it("returns unbounded text in python execution mode", async () => {
        const tool = buildWorkspaceReadTool();
        const context = createContext(workingDir, [], true);
        const largeLinePath = path.join(workingDir, "large-line.txt");
        const largeLine = "x".repeat(READ_LIMIT_TEST_BYTES);
        await fs.writeFile(largeLinePath, `${largeLine}\nline-2`, "utf8");

        const result = await tool.execute({ path: largeLinePath }, context, readToolCall);
        const text = toolMessageText(result.toolMessage.content);

        expect(result.toolMessage.isError).toBe(false);
        expect(text).toContain("line-2");
        expect(text).toContain(largeLine.slice(0, 256));
        expect(text).not.toContain("exceeds 50.0KB limit");
    });

    it("returns image content for supported image files", async () => {
        const tool = buildWorkspaceReadTool();
        const context = createContext(workingDir);
        const pngPath = path.join(workingDir, "image.png");
        const oneByOnePngBase64 =
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO5L5f8AAAAASUVORK5CYII=";
        await fs.writeFile(pngPath, Buffer.from(oneByOnePngBase64, "base64"));

        const result = await tool.execute({ path: pngPath }, context, readToolCall);
        expect(result.toolMessage.isError).toBe(false);
        expect(result.toolMessage.content.some((item) => item.type === "image")).toBe(true);
        const text = toolMessageText(result.toolMessage.content);
        expect(text).toContain("Read image file:");
        expect(text).toContain("[image/png]");
    });
});

describe("exec tool allowedDomains", () => {
    let workingDir: string;

    beforeEach(async () => {
        workingDir = await fs.mkdtemp(path.join(os.tmpdir(), "exec-tool-test-"));
    });

    afterEach(async () => {
        await fs.rm(workingDir, { recursive: true, force: true });
    });

    it("defaults missing allowedDomains to an empty list", async () => {
        const tool = buildExecTool();
        const context = createContext(workingDir);
        const exec = vi.fn(async (_args: { command: string; allowedDomains?: string[] }) => ({
            stdout: "ok",
            stderr: "",
            failed: false,
            exitCode: 0,
            signal: null,
            cwd: workingDir
        }));
        context.sandbox.exec = exec;

        const result = await tool.execute({ command: "echo ok" }, context, execToolCall);
        expect(result.toolMessage.isError).toBe(false);
        expect(result.typedResult.cwd).toBe(workingDir);
        expect(exec).toHaveBeenCalledOnce();
        const firstCall = exec.mock.calls[0]?.[0];
        expect(firstCall?.allowedDomains).toEqual([]);
    });

    it("forwards abort signal to sandbox exec", async () => {
        const tool = buildExecTool();
        const abortController = new AbortController();
        const context = createContext(workingDir, [], false, abortController.signal);
        const exec = vi.fn(async (_args: { command: string; allowedDomains?: string[]; signal?: AbortSignal }) => ({
            stdout: "ok",
            stderr: "",
            failed: false,
            exitCode: 0,
            signal: null,
            cwd: workingDir
        }));
        context.sandbox.exec = exec;

        const result = await tool.execute(
            { command: "echo ok", allowedDomains: ["example.com"] },
            context,
            execToolCall
        );
        expect(result.toolMessage.isError).toBe(false);
        expect(exec).toHaveBeenCalledOnce();
        const firstCall = exec.mock.calls[0]?.[0];
        expect(firstCall?.signal).toBe(abortController.signal);
    });

    it("rejects wildcard allowedDomains", async () => {
        const tool = buildExecTool();
        const context = createContext(workingDir);

        await expect(
            tool.execute({ command: "echo ok", allowedDomains: ["*"] }, context, execToolCall)
        ).rejects.toThrow("Wildcard");
    });

    itIfSandbox("executes command with explicit domains", async () => {
        const tool = buildExecTool();
        const context = createContext(workingDir);

        const result = await tool.execute(
            {
                command: "echo ok",
                allowedDomains: ["example.com"]
            },
            context,
            execToolCall
        );
        const text = toolMessageText(result.toolMessage.content);
        expect(result.toolMessage.isError).toBe(false);
        expect(text).toContain('"stdout": "ok"');
        expect(result.typedResult.output).toContain('"stdout": "ok"');
        expect("summary" in result.typedResult).toBe(false);
    });

    itIfSandbox("allows reading outside workspace", async () => {
        const tool = buildExecTool();
        const context = createContext(workingDir);
        const outsideDir = await fs.mkdtemp(path.join(os.tmpdir(), "exec-tool-outside-"));
        const outsideFile = path.join(outsideDir, "outside.txt");
        await fs.writeFile(outsideFile, "outside-content", "utf8");
        try {
            const result = await tool.execute(
                {
                    command: `cat "${outsideFile}"`,
                    allowedDomains: ["example.com"]
                },
                context,
                execToolCall
            );
            const text = toolMessageText(result.toolMessage.content);
            expect(result.toolMessage.isError).toBe(false);
            expect(text).toContain("outside-content");
        } finally {
            await fs.rm(outsideDir, { recursive: true, force: true });
        }
    });

    itIfSandbox("maps HOME to sandbox home path", async () => {
        const tool = buildExecTool();
        const context = createContext(workingDir, [workingDir]);

        const result = await tool.execute(
            {
                command: "printf '%s' \"$HOME\"",
                allowedDomains: ["example.com"]
            },
            context,
            execToolCall
        );
        const text = toolMessageText(result.toolMessage.content);
        const expectedHome = context.sandbox.homeDir;
        expect(result.toolMessage.isError).toBe(false);
        expect(text).toContain(`"stdout": "${expectedHome}"`);
    });

    itIfSandbox("denies writing to global /tmp when not write-granted", async () => {
        const tool = buildExecTool();
        const context = createContext(workingDir, [workingDir]);
        const blockedPath = path.join("/tmp", `daycare-exec-denied-${createId()}`);
        try {
            const result = await tool.execute(
                {
                    command: `printf '%s' blocked > "${blockedPath}"`,
                    allowedDomains: ["example.com"]
                },
                context,
                execToolCall
            );
            expect(result.toolMessage.isError).toBe(true);
            await expect(fs.access(blockedPath)).rejects.toThrow();
        } finally {
            await fs.rm(blockedPath, { force: true });
        }
    });

    itIfSandbox("does not mutate tool context permissions", async () => {
        const tool = buildExecTool();
        const context = createContext(workingDir, [workingDir]);
        const original = {
            workingDir: context.sandbox.permissions.workingDir,
            writeDirs: [...context.sandbox.permissions.writeDirs]
        };

        const result = await tool.execute(
            {
                command: "echo ok",
                allowedDomains: ["example.com"]
            },
            context,
            execToolCall
        );
        expect(result.toolMessage.isError).toBe(false);
        expect(context.sandbox.permissions).toEqual(original);
    });
});

describe("read_json tool", () => {
    let workingDir: string;
    let jsonPath: string;

    beforeEach(async () => {
        workingDir = await fs.mkdtemp(path.join(os.tmpdir(), "read-json-tool-workspace-"));
        jsonPath = path.join(workingDir, "data.json");
        await fs.writeFile(
            jsonPath,
            JSON.stringify(
                {
                    ok: true,
                    nested: { count: 3 },
                    rows: [{ id: "a" }, { id: "b" }]
                },
                null,
                2
            ),
            "utf8"
        );
    });

    afterEach(async () => {
        await fs.rm(workingDir, { recursive: true, force: true });
    });

    it("parses JSON and returns typed value", async () => {
        const tool = buildWorkspaceReadJsonTool();
        const context = createContext(workingDir);

        const result = await tool.execute({ path: jsonPath }, context, readJsonToolCall);
        expect(result.toolMessage.isError).toBe(false);
        expect(result.typedResult.action).toBe("read_json");
        expect(result.typedResult.path).toContain("data.json");
        expect((result.typedResult.value as { nested: { count: number } }).nested.count).toBe(3);
    });

    it("fails with clear error when JSON is invalid", async () => {
        const tool = buildWorkspaceReadJsonTool();
        const context = createContext(workingDir);
        const invalidPath = path.join(workingDir, "invalid.json");
        await fs.writeFile(invalidPath, "{ invalid", "utf8");

        await expect(tool.execute({ path: invalidPath }, context, readJsonToolCall)).rejects.toThrow("Invalid JSON");
    });

    it("reads the full file content before parsing", async () => {
        const tool = buildWorkspaceReadJsonTool();
        const context = createContext(workingDir);
        const result = await tool.execute({ path: jsonPath }, context, readJsonToolCall);
        expect((result.typedResult.value as { rows: Array<{ id: string }> }).rows).toHaveLength(2);
    });
});

describe("formatExecOutput", () => {
    it("tail-truncates stdout and returns JSON-structured output", () => {
        const stdout = `${"a".repeat(100)}${"z".repeat(9_000)}`;
        const text = formatExecOutput(stdout, "", false);
        const parsed = JSON.parse(text) as { stdout?: string };

        expect(parsed.stdout).toBeDefined();
        expect(parsed.stdout).toContain("chars truncated from stdout");
        expect(parsed.stdout?.endsWith("z".repeat(8_000))).toBe(true);
    });

    it("tail-truncates stderr and returns JSON-structured output", () => {
        const stderr = `${"x".repeat(100)}${"y".repeat(9_000)}`;
        const text = formatExecOutput("", stderr, true);
        const parsed = JSON.parse(text) as { stderr?: string };

        expect(parsed.stderr).toBeDefined();
        expect(parsed.stderr).toContain("chars truncated from stderr");
        expect(parsed.stderr?.endsWith("y".repeat(8_000))).toBe(true);
    });

    it("includes both streams and truncates each independently", () => {
        const stdout = `${"s".repeat(50)}${"o".repeat(9_000)}`;
        const stderr = `${"e".repeat(50)}${"r".repeat(9_000)}`;
        const text = formatExecOutput(stdout, stderr, true);
        const parsed = JSON.parse(text) as { stdout?: string; stderr?: string };

        expect(parsed.stdout).toContain("chars truncated from stdout");
        expect(parsed.stderr).toContain("chars truncated from stderr");
    });
});

function createContext(
    workingDir: string,
    writeDirs: string[] = [],
    pythonExecution = false,
    abortSignal?: AbortSignal,
    homeDir = workingDir
): ToolExecutionContext {
    const agentId = createId();
    const messageContext = {};
    const descriptor = {
        type: "subagent",
        id: agentId,
        parentAgentId: "system",
        name: "system"
    } as const;
    const now = Date.now();
    const state: AgentState = {
        context: { messages: [] },
        permissions: permissionsBuild(workingDir, writeDirs),
        tokens: null,
        stats: {},
        createdAt: now,
        updatedAt: now,
        state: "active"
    };
    const ctx = contextForAgent({ userId: "user-1", agentId });
    const agent = Agent.restore(
        ctx,
        descriptor,
        state,
        new AgentInbox(agentId),
        {} as unknown as Parameters<typeof Agent.restore>[4],
        new UserHome(path.join(workingDir, "users"), "user-1")
    );
    const sandbox = new Sandbox({
        homeDir,
        permissions: state.permissions
    });
    return {
        connectorRegistry: null as unknown as ToolExecutionContext["connectorRegistry"],
        sandbox,
        auth: null as unknown as ToolExecutionContext["auth"],
        logger: console as unknown as ToolExecutionContext["logger"],
        assistant: null,
        agent,
        ctx,
        source: "test",
        messageContext,
        pythonExecution,
        abortSignal,
        agentSystem: null as unknown as ToolExecutionContext["agentSystem"],
        heartbeats: null as unknown as ToolExecutionContext["heartbeats"]
    };
}

function permissionsBuild(workingDir: string, writeDirs: string[]): SessionPermissions {
    return {
        workingDir,
        writeDirs: writeDirs.map((entry) => path.resolve(entry))
    };
}

function toolMessageText(content: Array<{ type: string; text?: string }>): string {
    return content
        .filter((item) => item.type === "text")
        .map((item) => item.text ?? "")
        .join("\n");
}
