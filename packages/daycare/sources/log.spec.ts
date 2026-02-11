import { describe, expect, it } from "vitest";

import { formatPrettyMessage } from "./log.js";

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

  it("normalizes legacy message text to domain:action prefix", () => {
    const output = stripAnsi(
      formatPrettyMessage(
        {
          time: "2026-01-02T03:04:05.000Z",
          level: 30,
          module: "cron.scheduler",
          msg: "CronScheduler initialized"
        },
        "msg",
        "info"
      )
    );

    expect(output).toContain("cron:init CronScheduler initialized");
  });

  it("does not re-prefix messages already in prefix notation", () => {
    const output = stripAnsi(
      formatPrettyMessage(
        {
          time: "2026-01-02T03:04:05.000Z",
          level: 30,
          module: "engine.runtime",
          msg: "engine:start boot"
        },
        "msg",
        "info"
      )
    );

    expect(output).toContain("engine:start boot");
    expect(output).not.toContain("engine:event engine:start boot");
  });

  it("fills empty messages with a module-based prefix", () => {
    const output = stripAnsi(
      formatPrettyMessage(
        {
          time: "2026-01-02T03:04:05.000Z",
          level: 30,
          module: "plugin.telegram",
          msg: "   "
        },
        "msg",
        "info"
      )
    );

    expect(output).toContain("(telegram            ) telegram:event");
  });
});

function stripAnsi(value: string): string {
  return value.replace(/\u001b\[[0-9;]*m/g, "");
}
