import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ToolExecutionContext, ToolExecutionResult } from "@/types";
import { configResolve } from "../../config/configResolve.js";
import { storageOpenTest } from "../../storage/storageOpenTest.js";
import { contextForAgent } from "../agents/context.js";
import { agentStateRead } from "../agents/ops/agentStateRead.js";
import { appExecute } from "./appExecute.js";
import type { AppDescriptor } from "./appTypes.js";

describe("appExecute", () => {
    let rootDir: string;

    beforeEach(async () => {
        rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-app-execute-"));
    });

    afterEach(async () => {
        await fs.rm(rootDir, { recursive: true, force: true });
    });

    it("configures app-agent permissions and sends the app task prompt", async () => {
        const config = configResolve(
            { engine: { dataDir: path.join(rootDir, "data") } },
            path.join(rootDir, "settings.json")
        );
        const storage = await storageOpenTest();
        const agentId = "agent-app-1";
        const now = Date.now();
        await storage.agents.create({
            id: agentId,
            userId: "user-1",
            type: "app",
            descriptor: {
                type: "app",
                id: agentId,
                parentAgentId: "parent-agent",
                name: "GitHub Reviewer",
                systemPrompt: "You are a focused PR review assistant.",
                appId: "github-reviewer"
            },
            activeSessionId: null,
            permissions: {
                workingDir: rootDir,
                writeDirs: [rootDir]
            },
            tokens: null,
            stats: {},
            lifecycle: "active",
            createdAt: now,
            updatedAt: now
        });
        await appFilesWrite(path.join(rootDir, "apps", "github-reviewer"));

        const post = vi.fn(async (_ctx: unknown, _target: unknown, _item: unknown) => undefined);
        const postAndAwait = vi.fn(async (_ctx: unknown, _target: unknown, _item: unknown) => ({
            type: "message" as const,
            responseText: "App response."
        }));
        const agentIdForTarget = vi.fn(async (_ctx: unknown, _target: unknown) => agentId);
        const updateAgentPermissions = vi.fn();
        const toolResolver = {
            listTools: () => [
                { name: "read", description: "read", parameters: { type: "object", properties: {} } },
                { name: "write", description: "write", parameters: { type: "object", properties: {} } },
                { name: "exec", description: "exec", parameters: { type: "object", properties: {} } },
                { name: "cron", description: "cron", parameters: { type: "object", properties: {} } }
            ],
            execute: async () =>
                ({
                    toolMessage: {
                        role: "toolResult",
                        toolCallId: "t1",
                        toolName: "read",
                        content: [{ type: "text", text: "ok" }],
                        isError: false,
                        timestamp: Date.now()
                    }
                }) as ToolExecutionResult
        };

        const context = {
            connectorRegistry: null as unknown as ToolExecutionContext["connectorRegistry"],
            sandbox: null as unknown as ToolExecutionContext["sandbox"],
            auth: null as unknown as ToolExecutionContext["auth"],
            logger: console as unknown as ToolExecutionContext["logger"],
            assistant: null,
            agent: { id: "parent-agent" } as ToolExecutionContext["agent"],
            ctx: { agentId: "parent-agent", userId: "user-1" } as ToolExecutionContext["ctx"],
            source: "test",
            messageContext: {},
            agentSystem: {
                config: { current: config },
                storage,
                agentIdForTarget,
                updateAgentPermissions,
                post,
                postAndAwait,
                userHomeForUserId: () => ({ apps: path.join(rootDir, "apps") }),
                inferenceRouter: {} as unknown,
                toolResolver
            } as unknown as ToolExecutionContext["agentSystem"],
            heartbeats: null as unknown as ToolExecutionContext["heartbeats"]
        } as ToolExecutionContext;

        const app: AppDescriptor = {
            id: "github-reviewer",
            path: path.join(rootDir, "apps", "github-reviewer"),
            manifest: {
                name: "github-reviewer",
                title: "GitHub Reviewer",
                description: "Reviews pull requests",
                systemPrompt: "You are a focused PR review assistant."
            },
            permissions: {
                sourceIntent: "Review pull requests safely.",
                rules: {
                    allow: [{ text: "Read files" }],
                    deny: [{ text: "Delete files" }]
                }
            }
        };

        const result = await appExecute({
            app,
            prompt: "Review PR #42",
            context,
            waitForResponse: true
        });
        expect(result).toEqual({ agentId, responseText: "App response." });
        expect(agentIdForTarget).toHaveBeenCalledTimes(1);
        const targetCall = agentIdForTarget.mock.calls[0];
        if (!targetCall) {
            throw new Error("Expected agentIdForTarget call");
        }
        expect(targetCall[0]).toEqual(context.ctx);
        expect(targetCall[1]).toMatchObject({
            descriptor: {
                type: "app",
                id: expect.any(String),
                parentAgentId: "parent-agent",
                name: "GitHub Reviewer",
                systemPrompt: expect.stringContaining("You are a focused PR review assistant."),
                appId: "github-reviewer"
            }
        });

        expect(updateAgentPermissions).toHaveBeenCalledTimes(1);
        expect(post).not.toHaveBeenCalled();
        expect(postAndAwait).toHaveBeenCalledTimes(1);
        const firstCall = postAndAwait.mock.calls[0];
        if (!firstCall) {
            throw new Error("Expected postAndAwait call");
        }
        expect(firstCall[0]).toEqual(context.ctx);
        const item = firstCall[2] as unknown;
        expect(item).toMatchObject({
            type: "message",
            message: {
                text: [
                    'You are running app "GitHub Reviewer" (github-reviewer).',
                    "Reviews pull requests",
                    "",
                    "Task:",
                    "Review PR #42"
                ].join("\n")
            }
        });
        expect(Object.keys(item as Record<string, unknown>).sort()).toEqual(["context", "message", "type"]);

        const updated = await agentStateRead(storage, contextForAgent({ userId: "user-1", agentId }));
        expect(updated?.permissions.workingDir).toBe(path.join(rootDir, "apps", "github-reviewer", "data"));
        expect(updated?.permissions.writeDirs).toEqual([path.join(rootDir, "apps", "github-reviewer", "data")]);
        storage.db.close();
    });

    it("posts app task asynchronously by default", async () => {
        const config = configResolve(
            { engine: { dataDir: path.join(rootDir, "data") } },
            path.join(rootDir, "settings.json")
        );
        const storage = await storageOpenTest();
        const agentId = "agent-app-2";
        const now = Date.now();
        await storage.agents.create({
            id: agentId,
            userId: "user-1",
            type: "app",
            descriptor: {
                type: "app",
                id: agentId,
                parentAgentId: "parent-agent",
                name: "GitHub Reviewer",
                systemPrompt: "You are a focused PR review assistant.",
                appId: "github-reviewer"
            },
            activeSessionId: null,
            permissions: {
                workingDir: rootDir,
                writeDirs: [rootDir]
            },
            tokens: null,
            stats: {},
            lifecycle: "active",
            createdAt: now,
            updatedAt: now
        });
        await appFilesWrite(path.join(rootDir, "apps", "github-reviewer"));

        const post = vi.fn(async (_ctx: unknown, _target: unknown, _item: unknown) => undefined);
        const postAndAwait = vi.fn(async (_ctx: unknown, _target: unknown, _item: unknown) => ({
            type: "message" as const,
            responseText: "Should not be used."
        }));
        const agentIdForTarget = vi.fn(async (_ctx: unknown, _target: unknown) => agentId);
        const updateAgentPermissions = vi.fn();
        const toolResolver = {
            listTools: () => [
                { name: "read", description: "read", parameters: { type: "object", properties: {} } },
                { name: "write", description: "write", parameters: { type: "object", properties: {} } },
                { name: "exec", description: "exec", parameters: { type: "object", properties: {} } }
            ],
            execute: async () =>
                ({
                    toolMessage: {
                        role: "toolResult",
                        toolCallId: "t1",
                        toolName: "read",
                        content: [{ type: "text", text: "ok" }],
                        isError: false,
                        timestamp: Date.now()
                    }
                }) as ToolExecutionResult
        };

        const context = {
            connectorRegistry: null as unknown as ToolExecutionContext["connectorRegistry"],
            sandbox: null as unknown as ToolExecutionContext["sandbox"],
            auth: null as unknown as ToolExecutionContext["auth"],
            logger: console as unknown as ToolExecutionContext["logger"],
            assistant: null,
            agent: { id: "parent-agent" } as ToolExecutionContext["agent"],
            ctx: { agentId: "parent-agent", userId: "user-1" } as ToolExecutionContext["ctx"],
            source: "test",
            messageContext: {},
            agentSystem: {
                config: { current: config },
                storage,
                agentIdForTarget,
                updateAgentPermissions,
                post,
                postAndAwait,
                userHomeForUserId: () => ({ apps: path.join(rootDir, "apps") }),
                inferenceRouter: {} as unknown,
                toolResolver
            } as unknown as ToolExecutionContext["agentSystem"],
            heartbeats: null as unknown as ToolExecutionContext["heartbeats"]
        } as ToolExecutionContext;

        const app: AppDescriptor = {
            id: "github-reviewer",
            path: path.join(rootDir, "apps", "github-reviewer"),
            manifest: {
                name: "github-reviewer",
                title: "GitHub Reviewer",
                description: "Reviews pull requests",
                systemPrompt: "You are a focused PR review assistant."
            },
            permissions: {
                sourceIntent: "Review pull requests safely.",
                rules: {
                    allow: [{ text: "Read files" }],
                    deny: [{ text: "Delete files" }]
                }
            }
        };

        const result = await appExecute({
            app,
            prompt: "Review PR #99",
            context
        });

        expect(result).toEqual({ agentId, responseText: null });
        expect(post).toHaveBeenCalledTimes(1);
        expect(postAndAwait).not.toHaveBeenCalled();
        const firstCall = post.mock.calls[0];
        if (!firstCall) {
            throw new Error("Expected post call");
        }
        expect(firstCall[0]).toEqual(context.ctx);
        const item = firstCall[2] as { type: string; message?: { text?: string } };
        expect(item.type).toBe("message");
        expect(item.message?.text).toContain("Task:");
        expect(item.message?.text).toContain("Review PR #99");
        storage.db.close();
    });
});

async function appFilesWrite(appDir: string): Promise<void> {
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
}
