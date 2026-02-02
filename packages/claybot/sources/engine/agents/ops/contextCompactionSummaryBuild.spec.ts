import { describe, it, expect } from "vitest";

import { contextCompactionSummaryBuild } from "./contextCompactionSummaryBuild.js";

describe("contextCompactionSummaryBuild", () => {
  it("formats summary and persist list", () => {
    const result = contextCompactionSummaryBuild("Summary line", ["/path", "cmd"]);
    expect(result).toContain("Compaction Summary:");
    expect(result).toContain("Summary line");
    expect(result).toContain("Persist:");
    expect(result).toContain("- /path");
    expect(result).toContain("- cmd");
  });

  it("fills persist with None when empty", () => {
    const result = contextCompactionSummaryBuild("Summary", []);
    expect(result).toContain("- None");
  });
});
