import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ToolExecutionContext } from "@/types";
import { ToolResolver } from "../modules/toolResolver.js";
import { Apps } from "./appManager.js";
import { appPermissionsParse } from "./appPermissionsParse.js";
import { appPermissionsValidate } from "./appPermissionsValidate.js";
import { appRuleToolBuild } from "./appRuleToolBuild.js";

describe("appRuleToolBuild", () => {
    let workspaceDir: string;

    beforeEach(async () => {
        workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-app-rules-tool-"));
        const appDir = path.join(workspaceDir, "apps", "github-reviewer");
        await fs.mkdir(appDir, { recursive: true });
        await fs.writeFile(
            path.join(appDir, "APP.md"),
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
            path.join(appDir, "PERMISSIONS.md"),
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
    });

    afterEach(async () => {
        await fs.rm(workspaceDir, { recursive: true, force: true });
    });

    it("returns the permission result when approval is denied", async () => {
        const apps = new Apps({ workspaceDir });
        await apps.discover();
        const tool = appRuleToolBuild(apps);
        const context = contextBuild(workspaceDir);
        const executeSpy = vi
            .spyOn(context.agentSystem.toolResolver, "execute")
            .mockResolvedValue(permissionResultBuild({ approved: false, text: "Permission denied for write access." }));

        const denied = await tool.execute(
            {
                app_id: "github-reviewer",
                action: "add_allow",
                rule: "Access network"
            },
            context,
            { id: "tool-1", name: "app_rules" }
        );
        expect(denied.toolMessage.isError).toBe(false);
        expect(contentText(denied.toolMessage.content)).toContain("Permission denied");
        expect(executeSpy).toHaveBeenCalledTimes(1);
        expect(executeSpy.mock.calls[0]?.[0]).toMatchObject({
            name: "request_permission",
            arguments: expect.objectContaining({
                permissions: [expect.stringContaining("/apps/github-reviewer/PERMISSIONS.md")]
            })
        });

        const permissions = await permissionsRead(path.join(workspaceDir, "apps", "github-reviewer", "PERMISSIONS.md"));
        expect(permissions.rules.allow.map((rule) => rule.text)).not.toContain("Access network");
    });

    it("applies rule changes after permission approval", async () => {
        const apps = new Apps({ workspaceDir });
        await apps.discover();
        const tool = appRuleToolBuild(apps);
        const context = contextBuild(workspaceDir);
        const executeSpy = vi
            .spyOn(context.agentSystem.toolResolver, "execute")
            .mockResolvedValue(permissionResultBuild({ approved: true }));

        const applyResult = await tool.execute(
            {
                app_id: "github-reviewer",
                action: "add_deny",
                rule: "Delete files recursively"
            },
            context,
            { id: "tool-2", name: "app_rules" }
        );
        expect(applyResult.toolMessage.isError).toBe(false);
        expect(contentText(applyResult.toolMessage.content)).toContain("Rule added");
        expect(executeSpy).toHaveBeenCalledTimes(1);

        const permissions = await permissionsRead(path.join(workspaceDir, "apps", "github-reviewer", "PERMISSIONS.md"));
        expect(permissions.rules.deny.map((rule) => rule.text)).toContain("Delete files recursively");
    });
});

function contextBuild(workspaceDir: string): ToolExecutionContext {
    return {
        connectorRegistry: null as unknown as ToolExecutionContext["connectorRegistry"],
        fileStore: null as unknown as ToolExecutionContext["fileStore"],
        auth: null as unknown as ToolExecutionContext["auth"],
        logger: console as unknown as ToolExecutionContext["logger"],
        assistant: null,
        permissions: {
            workingDir: workspaceDir,
            writeDirs: [workspaceDir],
            readDirs: [workspaceDir],
            network: false,
            events: false
        },
        agent: { id: "agent-1" } as unknown as ToolExecutionContext["agent"],
        agentContext: null as unknown as ToolExecutionContext["agentContext"],
        source: "test",
        messageContext: {},
        agentSystem: { toolResolver: new ToolResolver() } as unknown as ToolExecutionContext["agentSystem"],
        heartbeats: null as unknown as ToolExecutionContext["heartbeats"]
    };
}

async function permissionsRead(permissionsPath: string) {
    const raw = await fs.readFile(permissionsPath, "utf8");
    return appPermissionsValidate(appPermissionsParse(raw));
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

function permissionResultBuild(input: { approved: boolean; text?: string }) {
    return {
        toolMessage: {
            role: "toolResult" as const,
            toolCallId: "permission-call",
            toolName: "request_permission",
            content: [{ type: "text" as const, text: input.text ?? "Permission granted for write access." }],
            details: { approved: input.approved },
            isError: false,
            timestamp: Date.now()
        },
        typedResult: { text: input.text ?? "Permission granted for write access." }
    };
}
