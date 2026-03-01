import { describe, expect, it } from "vitest";
import type { AgentInboxItem, AgentInboxResult } from "./agentTypes.js";

describe("agentTypes", () => {
    it("allows single-code executable system_message items", () => {
        const messageItem = {
            type: "system_message",
            text: "Run task",
            origin: "cron",
            taskId: "task-1",
            code: "print('ok')",
            context: { messageId: "msg-1" }
        } satisfies AgentInboxItem;

        expect(messageItem.type).toBe("system_message");
        expect(messageItem.code).toBe("print('ok')");
        expect(messageItem.taskId).toBe("task-1");
    });

    it("keeps system_message inbox result variant", () => {
        const result = {
            type: "system_message",
            responseText: "ok"
        } satisfies AgentInboxResult;

        expect(result.type).toBe("system_message");
    });
});
