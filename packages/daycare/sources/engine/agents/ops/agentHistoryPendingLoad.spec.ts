import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createId } from "@paralleldrive/cuid2";
import { describe, expect, it } from "vitest";

import { configResolve } from "../../../config/configResolve.js";
import { storageResolve } from "../../../storage/storageResolve.js";
import { storageUpgrade } from "../../../storage/storageUpgrade.js";
import { permissionBuildUser } from "../../permissions/permissionBuildUser.js";
import { UserHome } from "../../users/userHome.js";
import { contextForAgent } from "../context.js";
import { agentHistoryAppend } from "./agentHistoryAppend.js";
import { agentHistoryPendingLoad } from "./agentHistoryPendingLoad.js";
import { agentStateRead } from "./agentStateRead.js";
import { agentStateWrite } from "./agentStateWrite.js";
import { agentWrite } from "./agentWrite.js";

describe("agentHistoryPendingLoad", () => {
    it("loads only the latest run_python tail needed for pending-phase recovery", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-history-pending-"));
        const agentId = createId();
        try {
            const config = configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"));
            await storageUpgrade(config);
            const userId = createId();
            const permissions = permissionBuildUser(new UserHome(config.usersDir, userId));
            const ctx = contextForAgent({ userId, agentId });
            await agentWrite(
                storageResolve(config),
                ctx,
                `/${userId}/cron/${agentId}`,
                {
                    foreground: false,
                    name: "history",
                    description: null,
                    systemPrompt: null,
                    workspaceDir: null
                },
                permissions
            );

            const initial = await agentStateRead(config, ctx);
            if (!initial) {
                throw new Error("State missing");
            }

            const sessionId = await storageResolve(config).sessions.create({ agentId, createdAt: 1 });
            await agentStateWrite(config, ctx, { ...initial, activeSessionId: sessionId, updatedAt: 1 });

            await agentHistoryAppend(config, ctx, {
                type: "assistant_message",
                at: 2,
                content: [{ type: "toolCall", id: "old-tool", name: "run_python", arguments: { code: "old()" } }],
                tokens: null
            });
            await agentHistoryAppend(config, ctx, {
                type: "rlm_start",
                at: 3,
                toolCallId: "old-tool",
                code: "old()",
                preamble: "..."
            });
            await agentHistoryAppend(config, ctx, {
                type: "rlm_complete",
                at: 4,
                toolCallId: "old-tool",
                output: "done",
                printOutput: [],
                toolCallCount: 0,
                isError: false
            });
            await agentHistoryAppend(config, ctx, {
                type: "assistant_message",
                at: 10,
                content: [{ type: "toolCall", id: "new-tool", name: "run_python", arguments: { code: "new()" } }],
                tokens: null
            });
            await agentHistoryAppend(config, ctx, {
                type: "assistant_rewrite",
                at: 11,
                assistantAt: 10,
                text: "rewritten latest",
                reason: "run_python_failure_trim"
            });
            await agentHistoryAppend(config, ctx, {
                type: "rlm_start",
                at: 12,
                toolCallId: "new-tool",
                code: "new()",
                preamble: "..."
            });
            await agentHistoryAppend(config, ctx, {
                type: "rlm_tool_call",
                at: 13,
                toolCallId: "new-tool",
                snapshotId: "snap-2",
                printOutput: [],
                toolCallCount: 0,
                toolName: "echo",
                toolArgs: { text: "y" }
            });

            const records = await agentHistoryPendingLoad(config, ctx);

            expect(records).toEqual([
                {
                    type: "assistant_message",
                    at: 10,
                    content: [{ type: "toolCall", id: "new-tool", name: "run_python", arguments: { code: "new()" } }],
                    tokens: null
                },
                {
                    type: "assistant_rewrite",
                    at: 11,
                    assistantAt: 10,
                    text: "rewritten latest",
                    reason: "run_python_failure_trim"
                },
                {
                    type: "rlm_start",
                    at: 12,
                    toolCallId: "new-tool",
                    code: "new()",
                    preamble: "..."
                },
                {
                    type: "rlm_tool_call",
                    at: 13,
                    toolCallId: "new-tool",
                    snapshotId: "snap-2",
                    printOutput: [],
                    toolCallCount: 0,
                    toolName: "echo",
                    toolArgs: { text: "y" }
                }
            ]);
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("returns empty when the active session has no run_python turn to recover", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-history-pending-empty-"));
        const agentId = createId();
        try {
            const config = configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"));
            await storageUpgrade(config);
            const userId = createId();
            const permissions = permissionBuildUser(new UserHome(config.usersDir, userId));
            const ctx = contextForAgent({ userId, agentId });
            await agentWrite(
                storageResolve(config),
                ctx,
                `/${userId}/cron/${agentId}`,
                {
                    foreground: false,
                    name: "history",
                    description: null,
                    systemPrompt: null,
                    workspaceDir: null
                },
                permissions
            );

            const initial = await agentStateRead(config, ctx);
            if (!initial) {
                throw new Error("State missing");
            }

            const sessionId = await storageResolve(config).sessions.create({ agentId, createdAt: 1 });
            await agentStateWrite(config, ctx, { ...initial, activeSessionId: sessionId, updatedAt: 1 });
            await agentHistoryAppend(config, ctx, {
                type: "assistant_message",
                at: 2,
                content: [{ type: "text", text: "plain response" }],
                tokens: null
            });

            expect(await agentHistoryPendingLoad(config, ctx)).toEqual([]);
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("recognizes legacy text-form run_python assistant turns", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-history-pending-legacy-"));
        const agentId = createId();
        try {
            const config = configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"));
            await storageUpgrade(config);
            const userId = createId();
            const permissions = permissionBuildUser(new UserHome(config.usersDir, userId));
            const ctx = contextForAgent({ userId, agentId });
            await agentWrite(
                storageResolve(config),
                ctx,
                `/${userId}/cron/${agentId}`,
                {
                    foreground: false,
                    name: "history",
                    description: null,
                    systemPrompt: null,
                    workspaceDir: null
                },
                permissions
            );

            const initial = await agentStateRead(config, ctx);
            if (!initial) {
                throw new Error("State missing");
            }

            const sessionId = await storageResolve(config).sessions.create({ agentId, createdAt: 1 });
            await agentStateWrite(config, ctx, { ...initial, activeSessionId: sessionId, updatedAt: 1 });
            await agentHistoryAppend(config, ctx, {
                type: "assistant_message",
                at: 2,
                content: [{ type: "text", text: "<run_python>wait(300)</run_python>" }],
                tokens: null
            });
            await agentHistoryAppend(config, ctx, {
                type: "rlm_start",
                at: 3,
                toolCallId: "legacy-tool",
                code: "wait(300)",
                preamble: "..."
            });

            expect(await agentHistoryPendingLoad(config, ctx)).toEqual([
                {
                    type: "assistant_message",
                    at: 2,
                    content: [{ type: "text", text: "<run_python>wait(300)</run_python>" }],
                    tokens: null
                },
                {
                    type: "rlm_start",
                    at: 3,
                    toolCallId: "legacy-tool",
                    code: "wait(300)",
                    preamble: "..."
                }
            ]);
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });
});
