import { describe, expect, it } from "vitest";

import { agentDescriptorLabel } from "./agentDescriptorLabel.js";

describe("agentDescriptorLabel", () => {
  it("labels named agents", () => {
    expect(
      agentDescriptorLabel({
        type: "subagent",
        id: "sub-1",
        parentAgentId: "parent",
        name: "web-checker"
      })
    ).toBe("web-checker");
    expect(
      agentDescriptorLabel({
        type: "permanent",
        id: "perm-1",
        name: "memory",
        description: "desc",
        systemPrompt: "prompt"
      })
    ).toBe("memory");
  });

  it("labels non-user agents", () => {
    expect(
      agentDescriptorLabel({
        type: "cron",
        id: "cron-1"
      })
    ).toBe("cron:cron-1");
    expect(agentDescriptorLabel({ type: "heartbeat" })).toBe("heartbeat");
  });

  it("labels user agents", () => {
    expect(
      agentDescriptorLabel({
        type: "user",
        connector: "telegram",
        userId: "u1",
        channelId: "c1"
      })
    ).toBe("user");
  });
});
