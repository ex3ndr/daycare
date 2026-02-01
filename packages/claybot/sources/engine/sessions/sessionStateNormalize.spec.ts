import path from "node:path";

import { describe, expect, it } from "vitest";

import { sessionStateNormalize } from "./sessionStateNormalize.js";

const defaultPermissions = {
  workingDir: path.resolve("/tmp/work"),
  writeDirs: [path.resolve("/tmp/write")],
  readDirs: [path.resolve("/tmp/read")],
  web: false
};

describe("sessionStateNormalize", () => {
  it("returns fallback when state is invalid", () => {
    const result = sessionStateNormalize(null, defaultPermissions);

    expect(result.permissions).toEqual(defaultPermissions);
    expect(result.context.messages).toEqual([]);
    expect(result.session).toBeUndefined();
  });

  it("normalizes permissions and preserves context", () => {
    const result = sessionStateNormalize(
      {
        context: { messages: [] },
        providerId: "provider-1",
        permissions: {
          workingDir: "/tmp/work",
          writeDirs: ["/tmp/extra"],
          readDirs: [],
          web: true
        }
      },
      defaultPermissions
    );

    expect(result.providerId).toBe("provider-1");
    expect(result.permissions.writeDirs).toEqual(
      expect.arrayContaining([path.resolve("/tmp/write"), path.resolve("/tmp/extra")])
    );
  });
});
