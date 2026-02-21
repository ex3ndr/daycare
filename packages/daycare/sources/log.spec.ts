import { describe, expect, it } from "vitest";

import { formatPrettyMessage, initLogging, resetLogging } from "./log.js";

describe("initLogging", () => {
    it("defaults to silent level when running in vitest", () => {
        const previousVitest = process.env.VITEST;
        const previousDaycareLogLevel = process.env.DAYCARE_LOG_LEVEL;
        const previousLogLevel = process.env.LOG_LEVEL;

        try {
            process.env.VITEST = "true";
            delete process.env.DAYCARE_LOG_LEVEL;
            delete process.env.LOG_LEVEL;

            resetLogging();
            const logger = initLogging();

            expect(logger.level).toBe("silent");
        } finally {
            resetLogging();
            if (previousVitest === undefined) {
                delete process.env.VITEST;
            } else {
                process.env.VITEST = previousVitest;
            }
            if (previousDaycareLogLevel === undefined) {
                delete process.env.DAYCARE_LOG_LEVEL;
            } else {
                process.env.DAYCARE_LOG_LEVEL = previousDaycareLogLevel;
            }
            if (previousLogLevel === undefined) {
                delete process.env.LOG_LEVEL;
            } else {
                process.env.LOG_LEVEL = previousLogLevel;
            }
        }
    });
});

describe("formatPrettyMessage", () => {
    it("includes structured fields in pretty text output", () => {
        const output = stripAnsi(
            formatPrettyMessage(
                {
                    time: "2026-01-02T03:04:05.000Z",
                    level: 30,
                    module: "engine.test",
                    msg: "engine:start",
                    agentId: "agent-1",
                    retries: 2
                },
                "msg",
                "info"
            )
        );

        expect(output).toMatch(/\[\d{2}:\d{2}:\d{2}\] \[engine\.test {9}\] engine:start agentId=agent-1 retries=2/);
    });

    it("keeps plugin module labels in parenthesis", () => {
        const output = stripAnsi(
            formatPrettyMessage(
                {
                    time: "2026-01-02T03:04:05.000Z",
                    level: 30,
                    module: "plugin.telegram",
                    msg: "connector:start"
                },
                "msg",
                "info"
            )
        );

        expect(output).toContain("(telegram            ) connector:start");
    });

    it("does not duplicate keys already present in the message", () => {
        const output = stripAnsi(
            formatPrettyMessage(
                {
                    time: "2026-01-02T03:04:05.000Z",
                    level: 30,
                    module: "engine.test",
                    msg: "agent:restore agentId=agent-1",
                    agentId: "agent-1",
                    state: "awake"
                },
                "msg",
                "info"
            )
        );

        expect(output).toContain("agent:restore agentId=agent-1 state=awake");
        expect(output).not.toContain("agentId=agent-1 agentId=agent-1");
    });

    it("summarizes error objects into message text", () => {
        const output = stripAnsi(
            formatPrettyMessage(
                {
                    time: "2026-01-02T03:04:05.000Z",
                    level: 50,
                    module: "engine.test",
                    msg: "engine:tick-failed",
                    error: {
                        type: "Error",
                        code: "E_TEST",
                        message: "boom"
                    }
                },
                "msg",
                "error"
            )
        );

        expect(output).toContain("engine:tick-failed error=Error:code:E_TEST:boom");
    });
});

function stripAnsi(value: string): string {
    return value.replace(/\u001B\[[0-9;]*m/g, "");
}
