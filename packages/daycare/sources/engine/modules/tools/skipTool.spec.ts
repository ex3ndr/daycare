import { describe, expect, it } from "vitest";

import { skipToolBuild } from "./skipTool.js";

describe("skipToolBuild", () => {
    it("returns a tool named skip", () => {
        const definition = skipToolBuild();
        expect(definition.tool.name).toBe("skip");
    });

    it("executes and returns skipped status", async () => {
        const definition = skipToolBuild();
        const result = await definition.execute({}, null as never, { id: "call-1", name: "skip" });

        expect(result.toolMessage.isError).toBe(false);
        expect(result.typedResult).toEqual({ status: "skipped" });
    });

    it("includes Turn skipped in tool message text", async () => {
        const definition = skipToolBuild();
        const result = await definition.execute({}, null as never, { id: "call-1", name: "skip" });

        const text = result.toolMessage.content
            .filter((entry) => entry.type === "text")
            .map((entry) => ("text" in entry ? entry.text : ""))
            .join("");
        expect(text).toBe("Turn skipped");
    });
});
