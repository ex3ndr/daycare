import { describe, expect, it } from "vitest";

import { sessionDescriptorBuild } from "./sessionDescriptorBuild.js";

describe("sessionDescriptorBuild", () => {
  it("returns cron descriptors when cron task uid is present", () => {
    const descriptor = sessionDescriptorBuild(
      "cron",
      {
        channelId: "channel",
        userId: "user",
        cron: {
          taskId: "task",
          taskUid: "a".repeat(24),
          taskName: "Task",
          memoryPath: "/tmp/memory.md",
          filesPath: "/tmp/files"
        }
      },
      "session-1"
    );

    expect(descriptor).toEqual({ type: "cron", id: "a".repeat(24) });
  });

  it("returns heartbeat descriptors", () => {
    const descriptor = sessionDescriptorBuild(
      "heartbeat",
      { channelId: "channel", userId: "user", heartbeat: {} },
      "session-1"
    );

    expect(descriptor).toEqual({ type: "heartbeat" });
  });

  it("returns user descriptors for connector messages", () => {
    const descriptor = sessionDescriptorBuild(
      "slack",
      { channelId: "channel", userId: "user" },
      "session-1"
    );

    expect(descriptor).toEqual({
      type: "user",
      connector: "slack",
      userId: "user",
      channelId: "channel"
    });
  });

  it("returns subagent descriptors for background contexts", () => {
    const descriptor = sessionDescriptorBuild(
      "system",
      {
        channelId: "channel",
        userId: "user",
        agent: { kind: "background", parentSessionId: "parent", name: "agent" }
      },
      "session-1"
    );

    expect(descriptor).toEqual({
      type: "subagent",
      id: "session-1",
      parentSessionId: "parent",
      name: "agent"
    });
  });

  it("returns system descriptors when source is system", () => {
    const descriptor = sessionDescriptorBuild(
      "system",
      { channelId: "channel", userId: "user" },
      "session-1"
    );

    expect(descriptor).toEqual({
      type: "subagent",
      id: "session-1",
      parentSessionId: "system",
      name: "system"
    });
  });
});
