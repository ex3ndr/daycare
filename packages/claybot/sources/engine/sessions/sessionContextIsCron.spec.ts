import { describe, expect, it } from "vitest";

import { sessionContextIsCron } from "./sessionContextIsCron.js";

describe("sessionContextIsCron", () => {
  it("returns true for valid cron context", () => {
    expect(
      sessionContextIsCron({
        channelId: "c",
        userId: "u",
        cron: {
          taskId: "task",
          taskUid: "a".repeat(24),
          taskName: "Task",
          memoryPath: "/tmp/memory.md",
          filesPath: "/tmp/files"
        }
      })
    ).toBe(true);
  });

  it("returns true for cron session descriptors", () => {
    expect(
      sessionContextIsCron({ channelId: "c", userId: "u" }, { type: "cron", id: "task" })
    ).toBe(true);
  });
});
