import { describe, expect, it } from "vitest";

import { montyResponseTypeNameFromFunction } from "./montyResponseTypeNameFromFunction.js";

describe("montyResponseTypeNameFromFunction", () => {
    it("builds PascalCase names from snake_case function names", () => {
        expect(montyResponseTypeNameFromFunction("read_file")).toBe("ReadFileResponse");
        expect(montyResponseTypeNameFromFunction("web_search")).toBe("WebSearchResponse");
    });

    it("builds PascalCase names from mixed-case function names", () => {
        expect(montyResponseTypeNameFromFunction("webSearch")).toBe("WebSearchResponse");
        expect(montyResponseTypeNameFromFunction("URLFetch")).toBe("UrlFetchResponse");
    });
});
