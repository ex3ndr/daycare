import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ToolExecutionContext } from "@/types";
import { ToolResolver } from "../modules/toolResolver.js";
import { appInstallToolBuild } from "./appInstallToolBuild.js";
import type { Apps } from "./appManager.js";

describe("appInstallToolBuild", () => {
    let workspaceDir: string;
    let sourceRoot: string;

    beforeEach(async () => {
        workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-app-install-tool-workspace-"));
        sourceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-app-install-tool-source-"));
    });

    afterEach(async () => {
        await fs.rm(workspaceDir, { recursive: true, force: true });
        await fs.rm(sourceRoot, { recursive: true, force: true });
    });

    it("installs app from source and refreshes app manager", async () => {
        const sourceDir = path.join(sourceRoot, "github-reviewer");
        await fs.mkdir(sourceDir, { recursive: true });
        await fs.writeFile(
            path.join(sourceDir, "APP.md"),
            [
                "---",
                "name: github-reviewer",
                "title: GitHub Reviewer",
                "description: Reviews pull requests",
                "---",
                "",
                "## System Prompt",
                "",
                "You are a focused PR review assistant."
            ].join("\n")
        );
        await fs.writeFile(
            path.join(sourceDir, "PERMISSIONS.md"),
            [
                "## Source Intent",
                "",
                "Review pull requests safely.",
                "",
                "## Rules",
                "",
                "### Allow",
                "- Read files",
                "",
                "### Deny",
                "- Delete files"
            ].join("\n")
        );

        const discover = vi.fn(async () => []);
        const registerTools = vi.fn();
        const apps = { discover, registerTools } as unknown as Apps;
        const tool = appInstallToolBuild(apps);

        const result = await tool.execute({ source: sourceDir }, contextBuild(workspaceDir), {
            id: "tool-1",
            name: "install_app"
        });

        expect(result.toolMessage.isError).toBe(false);
        expect(contentText(result.toolMessage.content)).toContain('Installed app "github-reviewer"');
        expect(discover).toHaveBeenCalledTimes(1);
        expect(registerTools).toHaveBeenCalledTimes(1);
    });

    it("throws a clear error when context userId is missing", async () => {
        const discover = vi.fn(async () => []);
        const registerTools = vi.fn();
        const apps = { discover, registerTools } as unknown as Apps;
        const tool = appInstallToolBuild(apps);

        await expect(
            tool.execute(
                { source: sourceRoot },
                {
                    ...contextBuild(workspaceDir),
                    ctx: null as unknown as ToolExecutionContext["ctx"]
                },
                { id: "tool-1", name: "install_app" }
            )
        ).rejects.toThrow("Tool context userId is required.");
    });
});

function contextBuild(workspaceDir: string): ToolExecutionContext {
    const toolResolver = new ToolResolver();
    return {
        connectorRegistry: null as unknown as ToolExecutionContext["connectorRegistry"],
        sandbox: null as unknown as ToolExecutionContext["sandbox"],
        auth: null as unknown as ToolExecutionContext["auth"],
        logger: console as unknown as ToolExecutionContext["logger"],
        assistant: null,
        agent: { id: "agent-1" } as unknown as ToolExecutionContext["agent"],
        ctx: { agentId: "agent-1", userId: "user-1" } as ToolExecutionContext["ctx"],
        source: "test",
        messageContext: {},
        agentSystem: {
            config: { current: { workspaceDir } },
            userHomeForUserId: () => ({ apps: path.join(workspaceDir, "apps") }),
            toolResolver
        } as unknown as ToolExecutionContext["agentSystem"]
    };
}

function contentText(content: unknown): string {
    if (!Array.isArray(content)) {
        return "";
    }
    return content
        .filter((entry) => typeof entry === "object" && entry !== null && (entry as { type?: unknown }).type === "text")
        .map((entry) => (entry as { text?: string }).text ?? "")
        .join("\n");
}
