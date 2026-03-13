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
            "from typing import Any, NotRequired, TypedDict",
            "",
            "ToolError = RuntimeError",
            "",
            "# Typed tool stubs for code assistance only.",
            'ReadFileResponse = TypedDict("ReadFileResponse", { "summary": str, "size": int })',
            "",
            'SkipResponse = TypedDict("SkipResponse", {})',
            "",
            'JsonParseResponse = TypedDict("JsonParseResponse", { "value": Any })',
            "",
            'JsonStringifyResponse = TypedDict("JsonStringifyResponse", { "value": str })',
            "",
            "def read_file(path: str, retries: int | None = None, verbose: bool | None = None) -> ReadFileResponse:",
            '    """Read a file from disk."""',
            '    raise NotImplementedError("read_file is provided by runtime.")',
            "",
            "def skip() -> SkipResponse:",
            '    """Skip this turn — no LLM inference will run. All print() output is discarded. Call only when the task is fully mechanical or there is nothing to do."""',
            '    raise NotImplementedError("skip is provided by runtime.")',
            "",
            "def step(prompt: str) -> None:",
            '    """Send prompt text to the target agent and wait for it to finish. Only available in tasks."""',
            '    raise NotImplementedError("step is provided by runtime.")',
            "",
            "def context_reset(message: str | None = None) -> None:",
            '    """Reset the current agent session. Optional `message` seeds the new context. Only available in tasks."""',
            '    raise NotImplementedError("context_reset is provided by runtime.")',
            "",
            "def context_compact() -> None:",
            '    """Compact the current agent session and wait for it to finish. Only available in tasks."""',
            '    raise NotImplementedError("context_compact is provided by runtime.")',
            "",
            "def json_parse(text: str) -> JsonParseResponse:",
            '    """Parse JSON string text and return the parsed value in `value`."""',
            '    raise NotImplementedError("json_parse is provided by runtime.")',
            "",
            "def json_stringify(value: Any, pretty: bool | None = None) -> JsonStringifyResponse:",
            '    """Serialize a value into a JSON string in `value`. Set pretty=True for indentation."""',
            '    raise NotImplementedError("json_stringify is provided by runtime.")'
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
            "from typing import Any, NotRequired, TypedDict",
            "",
            "ToolError = RuntimeError",
            "",
            "# Typed tool stubs for code assistance only.",
            'SearchV2ResponseRowsItem = TypedDict("SearchV2ResponseRowsItem", { "title": str, "score": NotRequired[float] })',
            "",
            'SearchV2Response = TypedDict("SearchV2Response", { "rows": list[SearchV2ResponseRowsItem] })',
            "",
            'SkipResponse = TypedDict("SkipResponse", {})',
            "",
            'JsonParseResponse = TypedDict("JsonParseResponse", { "value": Any })',
            "",
            'JsonStringifyResponse = TypedDict("JsonStringifyResponse", { "value": str })',
            "",
            "def search_v2(query: str) -> SearchV2Response:",
            '    """valid python name"""',
            '    raise NotImplementedError("search_v2 is provided by runtime.")',
            "",
            "def skip() -> SkipResponse:",
            '    """Skip this turn — no LLM inference will run. All print() output is discarded. Call only when the task is fully mechanical or there is nothing to do."""',
            '    raise NotImplementedError("skip is provided by runtime.")',
            "",
            "def step(prompt: str) -> None:",
            '    """Send prompt text to the target agent and wait for it to finish. Only available in tasks."""',
            '    raise NotImplementedError("step is provided by runtime.")',
            "",
            "def context_reset(message: str | None = None) -> None:",
            '    """Reset the current agent session. Optional `message` seeds the new context. Only available in tasks."""',
            '    raise NotImplementedError("context_reset is provided by runtime.")',
            "",
            "def context_compact() -> None:",
            '    """Compact the current agent session and wait for it to finish. Only available in tasks."""',
            '    raise NotImplementedError("context_compact is provided by runtime.")',
            "",
            "def json_parse(text: str) -> JsonParseResponse:",
            '    """Parse JSON string text and return the parsed value in `value`."""',
            '    raise NotImplementedError("json_parse is provided by runtime.")',
            "",
            "def json_stringify(value: Any, pretty: bool | None = None) -> JsonStringifyResponse:",
            '    """Serialize a value into a JSON string in `value`. Set pretty=True for indentation."""',
            '    raise NotImplementedError("json_stringify is provided by runtime.")'
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
            "from typing import Any, NotRequired, TypedDict",
            "",
            "ToolError = RuntimeError",
            "",
            "# Typed tool stubs for code assistance only.",
            'SkipResponse = TypedDict("SkipResponse", {})',
            "",
            'JsonParseResponse = TypedDict("JsonParseResponse", { "value": Any })',
            "",
            'JsonStringifyResponse = TypedDict("JsonStringifyResponse", { "value": str })',
            "",
            "def skip() -> SkipResponse:",
            '    """Skip this turn — no LLM inference will run. All print() output is discarded. Call only when the task is fully mechanical or there is nothing to do."""',
            '    raise NotImplementedError("skip is provided by runtime.")',
            "",
            "def step(prompt: str) -> None:",
            '    """Send prompt text to the target agent and wait for it to finish. Only available in tasks."""',
            '    raise NotImplementedError("step is provided by runtime.")',
            "",
            "def context_reset(message: str | None = None) -> None:",
            '    """Reset the current agent session. Optional `message` seeds the new context. Only available in tasks."""',
            '    raise NotImplementedError("context_reset is provided by runtime.")',
            "",
            "def context_compact() -> None:",
            '    """Compact the current agent session and wait for it to finish. Only available in tasks."""',
            '    raise NotImplementedError("context_compact is provided by runtime.")',
            "",
            "def json_parse(text: str) -> JsonParseResponse:",
            '    """Parse JSON string text and return the parsed value in `value`."""',
            '    raise NotImplementedError("json_parse is provided by runtime.")',
            "",
            "def json_stringify(value: Any, pretty: bool | None = None) -> JsonStringifyResponse:",
            '    """Serialize a value into a JSON string in `value`. Set pretty=True for indentation."""',
            '    raise NotImplementedError("json_stringify is provided by runtime.")'
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
