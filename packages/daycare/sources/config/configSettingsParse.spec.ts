import { describe, expect, it } from "vitest";

import { configSettingsParse } from "./configSettingsParse.js";

describe("configSettingsParse", () => {
  it("accepts features.noTools", () => {
    const parsed = configSettingsParse({
      features: {
        noTools: true
      }
    });

    expect(parsed.features?.noTools).toBe(true);
  });

  it("accepts engine.dbPath", () => {
    const parsed = configSettingsParse({
      engine: {
        dbPath: "/tmp/daycare/daycare.db"
      }
    });

    expect(parsed.engine?.dbPath).toBe("/tmp/daycare/daycare.db");
  });
});
