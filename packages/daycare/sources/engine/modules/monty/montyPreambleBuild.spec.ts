import type { Tool } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";
import { describe, expect, it } from "vitest";
import { montyPreambleBuild } from "./montyPreambleBuild.js";
import { MONTY_RESPONSE_SCHEMA_KEY } from "./montyResponseSchemaKey.js";

describe("montyPreambleBuild", () => {
    it("renders full preamble with exact response typed dict and stub text", () => {
        const result = montyPreambleBuild([
            toolWithResponseSchemaBuild(
                {
                    name: "read_file",
                    description: "Read a file from disk.",
                    parameters: Type.Object(
                        {
                            path: Type.String(),
                            retries: Type.Optional(Type.Integer()),
                            verbose: Type.Optional(Type.Boolean())
                        },
                        { additionalProperties: false }
                    )
                },
                Type.Object(
                    {
                        summary: Type.String(),
                        size: Type.Integer()
                    },
                    { additionalProperties: false }
                )
            )
        ]);

        const expected = [
            "# You have the following tools available as Python functions.",
            "# Call tool functions directly (no await).",
            "# Tool failures raise ToolError (alias of RuntimeError).",
            "# Use print() for debug logs; the last expression is returned.",
            "",
            "from typing import Any, TypedDict",
            "",
            "ToolError = RuntimeError",
            "",
            "# Typed tool stubs for code assistance only.",
            'ReadFileResponse = TypedDict("ReadFileResponse", { "summary": str, "size": int })',
            "",
            "def read_file(path: str, retries: int | None = None, verbose: bool | None = None) -> ReadFileResponse:",
            '    """Read a file from disk."""',
            '    raise NotImplementedError("read_file is provided by runtime.")'
        ].join("\n");

        expect(result).toBe(expected);
    });

    it("generates nested response typed dicts and skips invalid tools", () => {
        const tools: Tool[] = [
            toolWithResponseSchemaBuild(
                {
                    name: "run_python",
                    description: "Meta tool",
                    parameters: Type.Object({ code: Type.String() }, { additionalProperties: false })
                },
                Type.Object({}, { additionalProperties: false })
            ),
            toolWithResponseSchemaBuild(
                {
                    name: "search-v2",
                    description: "invalid python name",
                    parameters: Type.Object({ query: Type.String() }, { additionalProperties: false })
                } as unknown as Tool,
                Type.Object({}, { additionalProperties: false })
            ),
            toolWithResponseSchemaBuild(
                {
                    name: "search_v2",
                    description: "valid python name",
                    parameters: Type.Object({ query: Type.String() }, { additionalProperties: false })
                },
                {
                    type: "object",
                    properties: {
                        rows: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    title: { type: "string" },
                                    score: { type: "number" }
                                },
                                required: ["title"]
                            }
                        }
                    },
                    required: ["rows"],
                    additionalProperties: false
                }
            )
        ];

        const result = montyPreambleBuild(tools);
        const expected = [
            "# You have the following tools available as Python functions.",
            "# Call tool functions directly (no await).",
            "# Tool failures raise ToolError (alias of RuntimeError).",
            "# Use print() for debug logs; the last expression is returned.",
            "",
            "from typing import Any, TypedDict",
            "",
            "ToolError = RuntimeError",
            "",
            "# Typed tool stubs for code assistance only.",
            'SearchV2ResponseRowsItem = TypedDict("SearchV2ResponseRowsItem", { "title": str, "score": float })',
            "",
            'SearchV2Response = TypedDict("SearchV2Response", { "rows": list[SearchV2ResponseRowsItem] })',
            "",
            "def search_v2(query: str) -> SearchV2Response:",
            '    """valid python name"""',
            '    raise NotImplementedError("search_v2 is provided by runtime.")'
        ].join("\n");

        expect(result).toBe(expected);
    });

    it("renders pass when no callable tools remain", () => {
        const result = montyPreambleBuild([
            toolWithResponseSchemaBuild(
                {
                    name: "run_python",
                    description: "Meta tool",
                    parameters: Type.Object({ code: Type.String() }, { additionalProperties: false })
                },
                Type.Object({}, { additionalProperties: false })
            )
        ]);
        const expected = [
            "# You have the following tools available as Python functions.",
            "# Call tool functions directly (no await).",
            "# Tool failures raise ToolError (alias of RuntimeError).",
            "# Use print() for debug logs; the last expression is returned.",
            "",
            "from typing import Any, TypedDict",
            "",
            "ToolError = RuntimeError",
            "",
            "# Typed tool stubs for code assistance only."
        ].join("\n");

        expect(result).toBe(expected);
    });
});

function toolWithResponseSchemaBuild(tool: Tool, schema: unknown): Tool {
    const result = { ...tool } as Tool;
    Object.defineProperty(result, MONTY_RESPONSE_SCHEMA_KEY, {
        value: schema,
        enumerable: false,
        configurable: false
    });
    return result;
}
