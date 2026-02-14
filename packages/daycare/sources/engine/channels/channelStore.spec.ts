import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { Channel } from "@/types";
import {
  channelAppendMessage,
  channelLoad,
  channelNameNormalize,
  channelReadHistory,
  channelSave
} from "./channelStore.js";

describe("channelStore", () => {
  it("saves and loads channel definitions", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-channel-store-"));
    try {
      const channel: Channel = {
        id: "channel-1",
        name: "dev",
        leader: "agent-leader",
        members: [
          { agentId: "agent-a", username: "alice", joinedAt: 1 }
        ],
        createdAt: 1,
        updatedAt: 2
      };

      await channelSave(dir, channel);
      const loaded = await channelLoad(dir, "dev");

      expect(loaded).toEqual(channel);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("appends and reads channel message history with limits", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-channel-store-"));
    try {
      const channel: Channel = {
        id: "channel-1",
        name: "dev",
        leader: "agent-leader",
        members: [],
        createdAt: 1,
        updatedAt: 1
      };
      await channelSave(dir, channel);

      await channelAppendMessage(dir, "dev", {
        id: "m1",
        channelName: "dev",
        senderUsername: "alice",
        text: "hello",
        mentions: [],
        createdAt: 10
      });
      await channelAppendMessage(dir, "dev", {
        id: "m2",
        channelName: "dev",
        senderUsername: "bob",
        text: "hi",
        mentions: ["alice"],
        createdAt: 20
      });

      const full = await channelReadHistory(dir, "dev");
      const limited = await channelReadHistory(dir, "dev", 1);

      expect(full).toHaveLength(2);
      expect(full[0]?.id).toBe("m1");
      expect(full[1]?.id).toBe("m2");
      expect(limited).toHaveLength(1);
      expect(limited[0]?.id).toBe("m2");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("returns null or empty history for missing channels", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-channel-store-"));
    try {
      expect(await channelLoad(dir, "dev")).toBeNull();
      expect(await channelReadHistory(dir, "dev")).toEqual([]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("accepts slack-style channel names", () => {
    expect(channelNameNormalize("dev-team")).toBe("dev-team");
    expect(channelNameNormalize("ops_team_1")).toBe("ops_team_1");
    expect(channelNameNormalize("Release_2026")).toBe("release_2026");
  });

  it("rejects non slack-style channel names", () => {
    expect(() => channelNameNormalize("dev.team")).toThrow("Slack-style");
    expect(() => channelNameNormalize("dev team")).toThrow("Slack-style");
    expect(() => channelNameNormalize("")).toThrow("Slack-style");
  });
});
