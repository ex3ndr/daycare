import { describe, expect, it } from "vitest";

import { buildSpecArtifactFileIs } from "./buildSpecArtifactFileIs.js";

describe("buildSpecArtifactFileIs", () => {
    it("returns true for generated spec outputs", () => {
        expect(buildSpecArtifactFileIs("plugins/shell/tool.spec.js")).toBe(true);
        expect(buildSpecArtifactFileIs("plugins/shell/tool.spec.js.map")).toBe(true);
        expect(buildSpecArtifactFileIs("plugins/shell/tool.spec.d.ts")).toBe(true);
        expect(buildSpecArtifactFileIs("plugins/shell/tool.spec.d.ts.map")).toBe(true);
    });

    it("returns false for runtime files", () => {
        expect(buildSpecArtifactFileIs("plugins/shell/tool.js")).toBe(false);
        expect(buildSpecArtifactFileIs("plugins/shell/tool.d.ts")).toBe(false);
        expect(buildSpecArtifactFileIs("plugins/shell/plugin.json")).toBe(false);
    });
});
