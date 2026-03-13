import { describe, expect, it } from "vitest";

import { buildAssetSourceFileIs } from "./buildAssetSourceFileIs.js";

describe("buildAssetSourceFileIs", () => {
    it("returns false for typescript source files", () => {
        expect(buildAssetSourceFileIs("/tmp/file.ts")).toBe(false);
        expect(buildAssetSourceFileIs("/tmp/file.tsx")).toBe(false);
        expect(buildAssetSourceFileIs("/tmp/file.mts")).toBe(false);
        expect(buildAssetSourceFileIs("/tmp/file.cts")).toBe(false);
    });

    it("returns true for non-typescript assets", () => {
        expect(buildAssetSourceFileIs("/tmp/README.md")).toBe(true);
        expect(buildAssetSourceFileIs("/tmp/task.py")).toBe(true);
        expect(buildAssetSourceFileIs("/tmp/plugin.json")).toBe(true);
    });
});
