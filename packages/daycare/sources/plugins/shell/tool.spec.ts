import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createId } from "@paralleldrive/cuid2";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// bwrap is unavailable in GitHub Actions (RTM_NEWADDR: Operation not permitted)
const itIfSandbox = process.env.CI ? it.skip : it;

import type { AgentState, SessionPermissions, ToolExecutionContext } from "@/types";
import { Agent } from "../../engine/agents/agent.js";
import { AgentInbox } from "../../engine/agents/ops/agentInbox.js";
import { UserHome } from "../../engine/users/userHome.js";
import { buildExecTool, buildWorkspaceReadTool, formatExecOutput } from "./tool.js";

const execToolCall = { id: "tool-call-1", name: "exec" };
const readToolCall = { id: "tool-call-2", name: "read" };
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

    it("requires explicit allowedDomains", async () => {
        const tool = buildExecTool();
        const context = createContext(workingDir);

        await expect(tool.execute({ command: "echo ok" }, context, execToolCall)).rejects.toThrow(
            "allowedDomains must include at least one explicit domain"
        );
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
        expect(text).toContain("stdout:\nok");
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

    itIfSandbox("maps HOME to provided home path", async () => {
        const tool = buildExecTool();
        const context = createContext(workingDir, [workingDir]);
        const home = path.join(workingDir, ".daycare-home");
        await fs.mkdir(home, { recursive: true });

        const result = await tool.execute(
            {
                command: "printf '%s' \"$HOME\"",
                home,
                allowedDomains: ["example.com"]
            },
            context,
            execToolCall
        );
        const text = toolMessageText(result.toolMessage.content);
        const expectedHome = await fs.realpath(home);
        expect(result.toolMessage.isError).toBe(false);
        expect(text).toContain(`stdout:\n${expectedHome}`);
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

    itIfSandbox("rejects HOME path when not write-granted", async () => {
        const tool = buildExecTool();
        const context = createContext(workingDir);
        const home = path.join(workingDir, ".daycare-home");

        await expect(
            tool.execute(
                {
                    command: "echo ok",
                    home,
                    allowedDomains: ["example.com"]
                },
                context,
                execToolCall
            )
        ).rejects.toThrow("Path is outside the allowed directories.");
    });

    itIfSandbox("does not mutate tool context permissions", async () => {
        const tool = buildExecTool();
        const context = createContext(workingDir, [workingDir]);
        const original = {
            workingDir: context.permissions.workingDir,
            writeDirs: [...context.permissions.writeDirs]
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
        expect(context.permissions).toEqual(original);
    });
});

describe("formatExecOutput", () => {
    it("tail-truncates stdout with stream label notice", () => {
        const stdout = `${"a".repeat(100)}${"z".repeat(9_000)}`;
        const text = formatExecOutput(stdout, "", false);

        expect(text).toContain("stdout:");
        expect(text).toContain("chars truncated from stdout");
        expect(text.endsWith("z".repeat(8_000))).toBe(true);
    });

    it("tail-truncates stderr with stream label notice", () => {
        const stderr = `${"x".repeat(100)}${"y".repeat(9_000)}`;
        const text = formatExecOutput("", stderr, true);

        expect(text).toContain("stderr:");
        expect(text).toContain("chars truncated from stderr");
        expect(text.endsWith("y".repeat(8_000))).toBe(true);
    });

    it("includes both streams and truncates each independently", () => {
        const stdout = `${"s".repeat(50)}${"o".repeat(9_000)}`;
        const stderr = `${"e".repeat(50)}${"r".repeat(9_000)}`;
        const text = formatExecOutput(stdout, stderr, true);

        expect(text).toContain("stdout:");
        expect(text).toContain("stderr:");
        expect(text).toContain("chars truncated from stdout");
        expect(text).toContain("chars truncated from stderr");
    });
});

function createContext(workingDir: string, writeDirs: string[] = []): ToolExecutionContext {
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
    const agent = Agent.restore(
        agentId,
        "user-1",
        descriptor,
        state,
        new AgentInbox(agentId),
        {} as unknown as Parameters<typeof Agent.restore>[5],
        new UserHome(path.join(workingDir, "users"), "user-1")
    );
    return {
        connectorRegistry: null as unknown as ToolExecutionContext["connectorRegistry"],
        fileStore: null as unknown as ToolExecutionContext["fileStore"],
        auth: null as unknown as ToolExecutionContext["auth"],
        logger: console as unknown as ToolExecutionContext["logger"],
        assistant: null,
        permissions: state.permissions,
        agent,
        ctx: null as unknown as ToolExecutionContext["ctx"],
        source: "test",
        messageContext,
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
