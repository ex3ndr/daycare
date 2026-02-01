import { describe, expect, it } from "vitest";

import { sessionTimestampGet } from "./sessionTimestampGet.js";

describe("sessionTimestampGet", () => {
  it("returns timestamps for dates and strings", () => {
    const date = new Date("2024-01-01T00:00:00Z");
    expect(sessionTimestampGet(date)).toBe(date.getTime());
    expect(sessionTimestampGet("2024-01-02T00:00:00Z")).toBe(
      new Date("2024-01-02T00:00:00Z").getTime()
    );
  });

  it("returns 0 for invalid values", () => {
    expect(sessionTimestampGet()).toBe(0);
    expect(sessionTimestampGet("not-a-date")).toBe(0);
  });
});
