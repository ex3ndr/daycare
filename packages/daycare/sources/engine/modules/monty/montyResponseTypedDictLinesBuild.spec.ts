import { describe, expect, it } from "vitest";

import { montyResponseTypedDictLinesBuild } from "./montyResponseTypedDictLinesBuild.js";

describe("montyResponseTypedDictLinesBuild", () => {
    it("builds typed dict lines with required and optional fields", () => {
        const lines = montyResponseTypedDictLinesBuild("ReadFileResponse", {
            type: "object",
            properties: {
                summary: { type: "string" },
                size: { type: "integer" }
            },
            required: ["summary"],
            additionalProperties: false
        });

        expect(lines.join("\n")).toBe(
            ['ReadFileResponse = TypedDict("ReadFileResponse", { "summary": str, "size": int })'].join("\n")
        );
    });

    it("builds nested typed dict lines for arrays of object rows", () => {
        const lines = montyResponseTypedDictLinesBuild("QueryResponse", {
            type: "object",
            properties: {
                rows: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            id: { type: "integer" },
                            name: { type: "string" }
                        },
                        required: ["id"]
                    }
                }
            },
            required: ["rows"],
            additionalProperties: false
        });

        expect(lines.join("\n")).toBe(
            [
                'QueryResponseRowsItem = TypedDict("QueryResponseRowsItem", { "id": int, "name": str })',
                "",
                'QueryResponse = TypedDict("QueryResponse", { "rows": list[QueryResponseRowsItem] })'
            ].join("\n")
        );
    });
});
