import { describe, expect, it } from "vitest";

import { buildCompiledFileIs } from "./buildCompiledFileIs.js";

describe("buildCompiledFileIs", () => {
    it("returns true for compiled outputs", () => {
        expect(buildCompiledFileIs("engine/main.js")).toBe(true);
        expect(buildCompiledFileIs("engine/main.js.map")).toBe(true);
        expect(buildCompiledFileIs("engine/main.d.ts")).toBe(true);
        expect(buildCompiledFileIs("engine/main.d.ts.map")).toBe(true);
    });

    it("returns false for copied assets", () => {
        expect(buildCompiledFileIs("prompts/MEMORY.md")).toBe(false);
        expect(buildCompiledFileIs("system-tasks/memory-compactor/task.py")).toBe(false);
        expect(buildCompiledFileIs("plugins/shell/plugin.json")).toBe(false);
    });
});
