import { describe, expect, it } from "vitest";

import { toolListContextBuild } from "./toolListContextBuild.js";

describe("toolListContextBuild", () => {
    it("always returns an empty tool list for inference context", () => {
        expect(toolListContextBuild()).toEqual([]);
    });
});
