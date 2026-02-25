import type { Tool } from "@mariozechner/pi-ai";
import { describe, expect, it } from "vitest";

import { toolListContextBuild } from "./toolListContextBuild.js";

describe("toolListContextBuild", () => {
    it("always returns an empty tool list for inference context", () => {
        const tools = [
            { name: "read", description: "Read file", parameters: {} },
            { name: "run_python", description: "Execute Python", parameters: {} }
        ] as unknown as Tool[];

        expect(toolListContextBuild({ tools })).toEqual([]);
    });
});
