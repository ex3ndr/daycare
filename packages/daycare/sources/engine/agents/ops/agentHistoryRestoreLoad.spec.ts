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
import { agentHistoryRestoreLoad } from "./agentHistoryRestoreLoad.js";
import { agentStateRead } from "./agentStateRead.js";
import { agentStateWrite } from "./agentStateWrite.js";
import { agentWrite } from "./agentWrite.js";

describe("agentHistoryRestoreLoad", () => {
    it("loads only the restore-relevant tail after the latest compaction summary", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-history-restore-"));
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

            await agentHistoryAppend(config, ctx, { type: "user_message", at: 2, text: "before", files: [] });
            await agentHistoryAppend(config, ctx, {
                type: "assistant_message",
                at: 3,
                content: [{ type: "text", text: "old assistant" }],
                tokens: null
            });
            await agentHistoryAppend(config, ctx, {
                type: "user_message",
                at: 4,
                text: "Compacted summary\n\nPlease continue with the user's latest request.",
                files: []
            });
            await agentHistoryAppend(config, ctx, {
                type: "rlm_tool_call",
                at: 5,
                toolCallId: "tool-1",
                snapshotId: "snap-1",
                printOutput: [],
                toolCallCount: 0,
                toolName: "echo",
                toolArgs: { text: "x" }
            });
            await agentHistoryAppend(config, ctx, {
                type: "assistant_message",
                at: 6,
                content: [{ type: "text", text: "after summary" }],
                tokens: null
            });
            await agentHistoryAppend(config, ctx, {
                type: "assistant_rewrite",
                at: 7,
                assistantAt: 6,
                text: "after summary rewritten",
                reason: "run_python_failure_trim"
            });
            await agentHistoryAppend(config, ctx, {
                type: "rlm_complete",
                at: 8,
                toolCallId: "tool-1",
                output: "done",
                printOutput: [],
                toolCallCount: 1,
                isError: false
            });

            const records = await agentHistoryRestoreLoad(config, ctx);

            expect(records).toEqual([
                {
                    type: "user_message",
                    at: 4,
                    text: "Compacted summary\n\nPlease continue with the user's latest request.",
                    files: []
                },
                {
                    type: "assistant_message",
                    at: 6,
                    content: [{ type: "text", text: "after summary" }],
                    tokens: null
                },
                {
                    type: "assistant_rewrite",
                    at: 7,
                    assistantAt: 6,
                    text: "after summary rewritten",
                    reason: "run_python_failure_trim"
                },
                {
                    type: "rlm_complete",
                    at: 8,
                    toolCallId: "tool-1",
                    output: "done",
                    printOutput: [],
                    toolCallCount: 1,
                    isError: false
                }
            ]);
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });
});
