import { describe, expect, it } from "vitest";

import { channelMessageBuild, channelSignalDataParse } from "./channelMessageBuild.js";

describe("channelMessageBuild", () => {
  it("formats channel messages with mentions and history", () => {
    const text = channelMessageBuild({
      channelName: "dev",
      messageId: "m3",
      senderUsername: "alice",
      text: "check this out",
      mentions: ["bob", "carol"],
      createdAt: 3,
      history: [
        {
          id: "m1",
          channelName: "dev",
          senderUsername: "bob",
          text: "hi",
          mentions: [],
          createdAt: 1
        },
        {
          id: "m2",
          channelName: "dev",
          senderUsername: "carol",
          text: "hello",
          mentions: ["alice"],
          createdAt: 2
        },
        {
          id: "m3",
          channelName: "dev",
          senderUsername: "alice",
          text: "check this out",
          mentions: ["bob", "carol"],
          createdAt: 3
        }
      ]
    });

    expect(text).toContain("[Channel: #dev] @alice: check this out");
    expect(text).toContain("mentions: @bob, @carol");
    expect(text).toContain("recent:");
    expect(text).toContain("- @bob: hi");
    expect(text).toContain("- @carol: hello");
    expect(text).not.toContain("- @alice: check this out");
  });

  it("returns null when channel signal payload shape is invalid", () => {
    expect(channelSignalDataParse(null)).toBeNull();
    expect(channelSignalDataParse({ channelName: "dev" })).toBeNull();
    expect(
      channelSignalDataParse({
        channelName: "dev",
        messageId: "m1",
        senderUsername: "alice",
        text: "hello",
        mentions: [],
        createdAt: Date.now(),
        history: []
      })
    ).not.toBeNull();
  });
});

