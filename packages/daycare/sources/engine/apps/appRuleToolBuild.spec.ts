import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ToolExecutionContext } from "@/types";
import { ToolResolver } from "../modules/toolResolver.js";
import { Apps } from "./appManager.js";
import { appPermissionsParse } from "./appPermissionsParse.js";
import { appPermissionsValidate } from "./appPermissionsValidate.js";
import { appRuleToolBuild } from "./appRuleToolBuild.js";

describe("appRuleToolBuild", () => {
    let workspaceDir: string;
    let usersDir: string;
    let appsDir: string;

    beforeEach(async () => {
        workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-app-rules-tool-"));
        usersDir = path.join(workspaceDir, "users");
        appsDir = path.join(usersDir, "user-1", "apps");
        const appDir = path.join(appsDir, "github-reviewer");
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

    it("applies allow rules directly", async () => {
        const apps = new Apps({ usersDir });
        await apps.discover();
        const tool = appRuleToolBuild(apps);
        const context = contextBuild(workspaceDir);

        const result = await tool.execute(
            {
                app_id: "github-reviewer",
                action: "add_allow",
                rule: "Access network"
            },
            context,
            { id: "tool-1", name: "app_rules" }
        );
        expect(result.toolMessage.isError).toBe(false);
        expect(contentText(result.toolMessage.content)).toContain("Rule added");

        const permissions = await permissionsRead(path.join(appsDir, "github-reviewer", "PERMISSIONS.md"));
        expect(permissions.rules.allow.map((rule) => rule.text)).toContain("Access network");
    });

    it("applies deny rule changes", async () => {
        const apps = new Apps({ usersDir });
        await apps.discover();
        const tool = appRuleToolBuild(apps);
        const context = contextBuild(workspaceDir);

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

        const permissions = await permissionsRead(path.join(appsDir, "github-reviewer", "PERMISSIONS.md"));
        expect(permissions.rules.deny.map((rule) => rule.text)).toContain("Delete files recursively");
    });
});

function contextBuild(workspaceDir: string): ToolExecutionContext {
    const usersDir = path.join(workspaceDir, "users");
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
            toolResolver: new ToolResolver(),
            config: { current: { usersDir } },
            userHomeForUserId: () => ({ apps: path.join(usersDir, "user-1", "apps") })
        } as unknown as ToolExecutionContext["agentSystem"],
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
