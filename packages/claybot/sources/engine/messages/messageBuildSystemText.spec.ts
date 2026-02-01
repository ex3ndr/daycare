import { describe, expect, it } from "vitest";

import { messageBuildSystemText } from "./messageBuildSystemText.js";

describe("messageBuildSystemText", () => {
  it("wraps trimmed text with system tags", () => {
    expect(messageBuildSystemText(" hello ")).toBe("<system_message>hello</system_message>");
  });

  it("adds origin metadata when provided", () => {
    expect(messageBuildSystemText("ping", "background")).toBe(
      "<system_message origin=\"background\">ping</system_message>"
    );
  });
});
